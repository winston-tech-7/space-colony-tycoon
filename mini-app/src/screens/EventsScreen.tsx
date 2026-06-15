import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Profile, Quest } from "../types";

interface HuntState {
  event: { name: string; creatureName: string; endsAt: string };
  participation: { huntCount: number } | null;
  leaderboard: Array<{ huntCount: number; user: { firstName: string; username: string | null } }>;
}

interface Props {
  profile: Profile;
  initData: string;
  onRefresh: () => void;
}

export function EventsScreen({ profile, initData, onRefresh }: Props) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [hunt, setHunt] = useState<HuntState | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState("");

  useEffect(() => {
    api<{ quests: Quest[] }>("/api/quests", initData).then((d) => setQuests(d.quests));
    api<HuntState>("/api/hunt", initData).then(setHunt);
  }, [initData, profile.medals]);

  async function spin() {
    setSpinning(true);
    try {
      const result = await api<{ prize: { label: string } }>("/api/wheel/spin", initData, {
        method: "POST",
        body: JSON.stringify({ spinId: crypto.randomUUID() }),
      });
      setPrize(result.prize.label);
      onRefresh();
    } catch (e) {
      setPrize(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSpinning(false);
    }
  }

  async function doHunt() {
    try {
      await api("/api/hunt", initData, { method: "POST" });
      const state = await api<HuntState>("/api/hunt", initData);
      setHunt(state);
      onRefresh();
    } catch (e) {
      setPrize(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="screen events-screen">
      <section className="panel-section wheel-panel">
        <h3 className="section-title">Космическая рулетка</h3>
        <div className={`wheel-disc ${spinning ? "spinning" : ""}`}>🎡</div>
        <p className="muted">Стоимость: 100 🏅 · Баланс: {profile.medals}</p>
        <button type="button" className="primary-btn" disabled={spinning} onClick={spin}>
          {spinning ? "Крутим..." : "Крутить"}
        </button>
        {prize && <p className="win-banner">{prize}</p>}
      </section>

      <section className="panel-section">
        <h3 className="section-title">Охота: {hunt?.event.creatureName ?? "..."}</h3>
        <p className="muted">{hunt?.event.name}</p>
        <p>Ваши охоты: {hunt?.participation?.huntCount ?? 0}</p>
        <button type="button" className="secondary-btn" onClick={doHunt}>
          Охотиться (+2 🏅)
        </button>
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
