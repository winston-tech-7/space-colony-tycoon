import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { ModeNav } from "./components/ModeNav";
import { useSocket } from "./hooks/useSocket";
import { useTelegram } from "./hooks/useTelegram";
import { AdmiralMode } from "./modes/AdmiralMode";
import { BattleMode } from "./modes/BattleMode";
import { ColonyMode } from "./modes/ColonyMode";
import { GuildMode } from "./modes/GuildMode";
import { ModeStub } from "./modes/ModeStub";
import { TradingMode } from "./modes/TradingMode";
import type { GameMode, GameModeId, Profile } from "./types";

function parseMode(startParam?: string): GameModeId {
  if (!startParam) return "colony";
  if (startParam.startsWith("join_")) return "guild";
  if (startParam.startsWith("nft_") || startParam === "market") return "trading";
  if (startParam.startsWith("challenge_")) return "battle";
  if (startParam.startsWith("expedition_")) return "expedition";
  const known = ["colony", "guild", "trading", "market", "battle", "expedition", "genetic", "admiral", "storyline"];
  if (known.includes(startParam)) {
    return startParam === "market" ? "trading" : (startParam as GameModeId);
  }
  return "colony";
}

export function App() {
  const { tg, initData, startParam } = useTelegram();
  const { socket, connected } = useSocket(initData);
  const [modes, setModes] = useState<GameMode[]>([]);
  const [activeMode, setActiveMode] = useState<GameModeId>(() => parseMode(startParam));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("Загрузка...");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!initData) {
      setError("Откройте через Telegram Mini App");
      return;
    }
    const data = await api<{
      profile: Profile;
      modes: GameMode[];
      user: { id: number };
    }>("/api/me", initData);
    setProfile(data.profile);
    setModes(data.modes);
    setUserId(String(data.user.id));
    setStatus("Колония загружена");
    setError("");
  }, [initData]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
  }, [refresh]);

  useEffect(() => {
    if (!tg) return;

    const handler = async () => {
      if (activeMode !== "colony") {
        setActiveMode("colony");
        return;
      }
      tg.MainButton.showProgress();
      tg.MainButton.disable();
      try {
        const result = await api<{ fed: number; evolved: number; profile: Profile }>(
          "/api/colony/feed",
          initData,
          { method: "POST" },
        );
        setProfile(result.profile);
        setStatus(
          result.evolved > 0
            ? `Покормлено ${result.fed}, эволюция: ${result.evolved}`
            : `Покормлено: ${result.fed}`,
        );
        tg.HapticFeedback?.impactOccurred("medium");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Ошибка");
      } finally {
        tg.MainButton.hideProgress();
        tg.MainButton.enable();
      }
    };

    if (activeMode === "colony") {
      tg.MainButton.text = "Покормить существ";
      tg.MainButton.show();
      tg.MainButton.onClick(handler);
    } else {
      tg.MainButton.hide();
    }

    return () => tg.MainButton.offClick(handler);
  }, [tg, initData, activeMode]);

  const mode = modes.find((m) => m.id === activeMode);
  const isImplemented =
    mode?.implemented ??
    ["colony", "guild", "trading", "battle", "admiral"].includes(activeMode);

  const challengeTarget = startParam?.startsWith("challenge_")
    ? startParam.replace("challenge_", "")
    : undefined;

  if (error && !profile) {
    return <div className="app error-screen"><p>{error}</p></div>;
  }

  if (!profile) {
    return <div className="app"><p className="status">Инициализация...</p></div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Space Colony 2.0</h1>
        <small>{connected ? "🟢 Live" : "⚪ Offline"}</small>
      </header>

      <ModeNav modes={modes} active={activeMode} onChange={setActiveMode} />

      {isImplemented && activeMode === "colony" && (
        <ColonyMode profile={profile} status={status} />
      )}
      {isImplemented && activeMode === "guild" && (
        <GuildMode initData={initData} profile={profile} onRefresh={refresh} />
      )}
      {isImplemented && activeMode === "trading" && (
        <TradingMode initData={initData} profile={profile} onRefresh={refresh} />
      )}
      {isImplemented && activeMode === "battle" && (
        <BattleMode
          initData={initData}
          profile={profile}
          userId={userId}
          challengeTarget={challengeTarget}
          socket={socket}
        />
      )}
      {isImplemented && activeMode === "admiral" && (
        <AdmiralMode initData={initData} />
      )}
      {!isImplemented && <ModeStub mode={activeMode} initData={initData} />}
    </div>
  );
}
