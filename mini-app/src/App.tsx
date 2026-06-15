import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { AppShell } from "./components/AppShell";
import { SplashScreen } from "./components/SplashScreen";
import type { HubModeId } from "./components/ModesHub";
import type { TabId } from "./lib/schema";
import { TradingMode } from "./modes/TradingMode";
import { CollectionScreen } from "./screens/CollectionScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useSocket } from "./hooks/useSocket";
import { useTelegram } from "./hooks/useTelegram";
import type { Profile } from "./types";

type StartPayload = {
  mode: string;
  payload?: string;
};

function parseTab(startParam?: string): TabId {
  if (startParam === "market" || startParam === "trading" || startParam?.startsWith("nft_")) {
    return "marketplace";
  }
  if (startParam === "collection") return "collection";
  if (
    startParam === "events" ||
    startParam === "wheel" ||
    startParam === "hunt" ||
    startParam === "battle" ||
    startParam === "guild" ||
    startParam === "admiral" ||
    startParam === "expedition" ||
    startParam === "genetic" ||
    startParam === "storyline" ||
    startParam?.startsWith("challenge_") ||
    startParam?.startsWith("join_")
  ) {
    return "events";
  }
  if (startParam === "leaderboard") return "leaderboard";
  if (startParam === "settings") return "settings";
  return "home";
}

function subModeFromStart(start?: StartPayload): HubModeId | null {
  if (!start) return null;
  if (start.mode === "battle" || start.payload?.startsWith("challenge_")) return "battle";
  if (start.mode === "guild" || start.payload?.startsWith("join_")) return "guild";
  if (start.mode === "admiral") return "admiral";
  if (start.mode === "expedition") return "expedition";
  if (start.mode === "genetic") return "genetic";
  if (start.mode === "storyline") return "storyline";
  return null;
}

function challengeFromStart(start?: StartPayload, startParam?: string): string {
  if (start?.mode === "battle" && start.payload && !start.payload.startsWith("challenge_")) {
    return start.payload;
  }
  if (startParam?.startsWith("challenge_")) {
    return startParam.replace("challenge_", "");
  }
  return "";
}

function guildTagFromStart(start?: StartPayload, startParam?: string): string | null {
  if (start?.mode === "guild" && start.payload && !start.payload.startsWith("join_")) {
    return start.payload;
  }
  if (startParam?.startsWith("join_")) {
    return startParam.replace("join_", "");
  }
  return null;
}

export function App() {
  const { tg, initData, startParam } = useTelegram();
  const { socket, connected } = useSocket(initData);
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTab(startParam));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [eventsSubMode, setEventsSubMode] = useState<HubModeId | null>(null);
  const [challengeTarget, setChallengeTarget] = useState("");

  const refresh = useCallback(async () => {
    if (!initData) {
      setError("Откройте через Telegram Mini App");
      return;
    }
    const data = await api<{
      profile: Profile;
      user: { id: number };
      start?: StartPayload;
      startParam?: string;
    }>("/api/me", initData);
    setProfile(data.profile);
    setUserId(String(data.user.id));

    const sub = subModeFromStart(data.start);
    if (sub) {
      setActiveTab("events");
      setEventsSubMode(sub);
      setChallengeTarget(challengeFromStart(data.start, data.startParam ?? startParam));
    }

    const guildTag = guildTagFromStart(data.start, data.startParam ?? startParam);
    if (guildTag && data.profile.guildMemberships.length === 0) {
      try {
        await api("/api/guild/join", initData, {
          method: "POST",
          body: JSON.stringify({ tag: guildTag }),
        });
        const again = await api<{ profile: Profile }>("/api/me", initData);
        setProfile(again.profile);
        setStatus(`Вы вступили в гильдию [${guildTag.toUpperCase()}]`);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Не удалось вступить в гильдию");
      }
    }

    setError("");
  }, [initData, startParam]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
  }, [refresh]);

  useEffect(() => {
    if (!tg) return;

    const handler = async () => {
      if (activeTab !== "home") {
        setActiveTab("home");
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
            ? `Покормлено ${result.fed} · эволюция ${result.evolved}`
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

    if (activeTab === "home") {
      tg.MainButton.text = "Покормить существ";
      tg.MainButton.show();
      tg.MainButton.onClick(handler);
    } else {
      tg.MainButton.hide();
    }

    return () => tg.MainButton.offClick(handler);
  }, [tg, initData, activeTab]);

  if (error && !profile) {
    return (
      <div className="app error-screen">
        <div className="error-card">
          <span className="error-icon">⚠️</span>
          <h2>Не удалось войти</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <SplashScreen message={initData ? "Синхронизация..." : "Ожидание Telegram..."} />;
  }

  const colony = profile.colonies[0];

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      credits={profile.credits}
      medals={profile.medals}
      tokens={profile.tokens}
      energy={colony?.energy}
      connected={connected}
      status={status}
    >
      {activeTab === "home" && (
        <HomeScreen
          profile={profile}
          initData={initData}
          userId={userId}
          onRefresh={refresh}
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === "collection" && (
        <CollectionScreen
          profile={profile}
          initData={initData}
          onRefresh={refresh}
          onHaptic={() => tg?.HapticFeedback?.impactOccurred("light")}
        />
      )}
      {activeTab === "marketplace" && (
        <TradingMode initData={initData} profile={profile} onRefresh={refresh} />
      )}
      {activeTab === "leaderboard" && <LeaderboardScreen initData={initData} />}
      {activeTab === "events" && (
        <EventsScreen
          profile={profile}
          initData={initData}
          userId={userId}
          socket={socket}
          initialSubMode={eventsSubMode}
          challengeTarget={challengeTarget}
          onRefresh={refresh}
          onSubModeConsumed={() => setEventsSubMode(null)}
        />
      )}
      {activeTab === "settings" && (
        <SettingsScreen profile={profile} userId={userId} />
      )}
    </AppShell>
  );
}
