import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AdmiralMode } from "../modes/AdmiralMode";
import { BattleMode } from "../modes/BattleMode";
import { GuildMode } from "../modes/GuildMode";
import { ModeStub } from "../modes/ModeStub";
import { GameArt } from "../components/GameArt";
import { ModesHub, type HubModeId } from "../components/ModesHub";
import { MODE_LABELS, newRequestId } from "../lib/labels";
import type { Profile, Quest } from "../types";
import type { Socket } from "socket.io-client";

interface HuntState {
  event: { name: string; creatureName: string; endsAt: string };
  participation: { huntCount: number } | null;
  leaderboard: Array<{ huntCount: number; user: { firstName: string; username: string | null } }>;
}

interface Props {
  profile: Profile;
  initData: string;
  userId: string;
  socket: Socket | null;
  initialSubMode?: HubModeId | null;
  challengeTarget?: string;
  onRefresh: () => void;
  onSubModeConsumed?: () => void;
}

export function EventsScreen({
  profile,
  initData,
  userId,
  socket,
  initialSubMode,
  challengeTarget,
  onRefresh,
  onSubModeConsumed,
}: Props) {
  const [subMode, setSubMode] = useState<HubModeId>(initialSubMode ?? "hub");
  const [quests, setQuests] = useState<Quest[]>([]);
  const [hunt, setHunt] = useState<HuntState | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelMsg, setWheelMsg] = useState("");
  const [huntMsg, setHuntMsg] = useState("");

  useEffect(() => {
    if (initialSubMode && initialSubMode !== "hub") {
      setSubMode(initialSubMode);
      onSubModeConsumed?.();
    }
  }, [initialSubMode, onSubModeConsumed]);

  useEffect(() => {
    api<{ quests: Quest[] }>("/api/quests", initData).then((d) => setQuests(d.quests));
    api<HuntState>("/api/hunt", initData).then(setHunt);
  }, [initData, profile.medals]);

  async function spin() {
    setSpinning(true);
    setWheelMsg("");
    try {
      const result = await api<{ prize: { label: string } }>("/api/wheel/spin", initData, {
        method: "POST",
        body: JSON.stringify({ spinId: newRequestId("spin") }),
      });
      setWheelMsg(result.prize.label);
      onRefresh();
    } catch (e) {
      setWheelMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSpinning(false);
    }
  }

  async function doHunt() {
    setHuntMsg("");
    try {
      await api("/api/hunt", initData, { method: "POST" });
      const state = await api<HuntState>("/api/hunt", initData);
      setHunt(state);
      setHuntMsg("Охота успешна! +2 🏅");
      onRefresh();
    } catch (e) {
      setHuntMsg(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (subMode !== "hub") {
    const title = MODE_LABELS[subMode]?.title ?? subMode;
    return (
      <div className="screen events-screen">
        <button type="button" className="link-btn back-link" onClick={() => setSubMode("hub")}>
          ← Назад к событиям
        </button>
        <h2 className="submode-title">{title}</h2>
        {subMode === "battle" && (
          <BattleMode
            initData={initData}
            profile={profile}
            userId={userId}
            challengeTarget={challengeTarget}
            socket={socket}
          />
        )}
        {subMode === "guild" && (
          <GuildMode initData={initData} profile={profile} onRefresh={onRefresh} />
        )}
        {subMode === "admiral" && <AdmiralMode initData={initData} />}
        {(subMode === "expedition" || subMode === "genetic" || subMode === "storyline") && (
          <ModeStub mode={subMode} initData={initData} />
        )}
      </div>
    );
  }

  return (
    <div className="screen events-screen">
      <ModesHub onSelect={setSubMode} />

      <section className="panel-section wheel-panel">
        <div className="panel-head-art">
          <GameArt kind="wheel" size={48} />
          <h3 className="section-title">Космическая рулетка</h3>
        </div>
        <div className={`wheel-disc ${spinning ? "spinning" : ""}`}>
          <GameArt kind="wheel" size={80} />
        </div>
        <p className="muted">Стоимость: 100 🏅 · Баланс: {profile.medals}</p>
        <button type="button" className="primary-btn" disabled={spinning} onClick={spin}>
          {spinning ? "Крутим..." : "Крутить"}
        </button>
        {wheelMsg && <p className="win-banner">{wheelMsg}</p>}
      </section>

      <section className="panel-section">
        <div className="panel-head-art">
          <GameArt kind="hunt" size={48} />
          <h3 className="section-title">Охота: {hunt?.event.creatureName ?? "..."}</h3>
        </div>
        <p className="muted">{hunt?.event.name}</p>
        <p>Ваши охоты: {hunt?.participation?.huntCount ?? 0}</p>
        <button type="button" className="secondary-btn" onClick={doHunt}>
          Охотиться (+2 🏅)
        </button>
        {huntMsg && <p className="win-banner">{huntMsg}</p>}
        <div className="rank-list compact">
          {hunt?.leaderboard.slice(0, 5).map((row, i) => (
            <div key={i} className="rank-row">
              <span className="rank-num">#{i + 1}</span>
              <span>{row.user.username ? `@${row.user.username}` : row.user.firstName}</span>
              <span className="rank-score">{row.huntCount}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3 className="section-title">Ежедневные задачи</h3>
        {quests.map((q) => (
          <article key={q.id} className="quest-card">
            <div>
              <strong>{q.title}</strong>
              <small>+{q.rewardMedals} 🏅</small>
            </div>
            <div className="progress">
              <div
                className="progress-bar"
                style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
              />
            </div>
            <small>{q.progress}/{q.target} {q.completed ? "✓" : ""}</small>
          </article>
        ))}
      </section>
    </div>
  );
}
