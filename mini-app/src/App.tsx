import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { AppShell } from "./components/AppShell";
import { SplashScreen } from "./components/SplashScreen";
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

function parseTab(startParam?: string): TabId {
  if (startParam === "market" || startParam === "trading") return "marketplace";
  if (startParam === "collection") return "collection";
  if (startParam === "events" || startParam === "wheel" || startParam === "hunt") return "events";
  if (startParam === "leaderboard") return "leaderboard";
  if (startParam === "settings") return "settings";
  return "home";
}

export function App() {
  const { tg, initData, startParam } = useTelegram();
  const { connected } = useSocket(initData);
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTab(startParam));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!initData) {
      setError("Откройте через Telegram Mini App");
      return;
    }
    const data = await api<{
      profile: Profile;
      user: { id: number };
    }>("/api/me", initData);
    setProfile(data.profile);
    setUserId(String(data.user.id));
    setStatus("");
    setError("");
  }, [initData]);

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
        <EventsScreen profile={profile} initData={initData} onRefresh={refresh} />
      )}
      {activeTab === "settings" && (
        <SettingsScreen profile={profile} userId={userId} />
      )}
    </AppShell>
  );
}
