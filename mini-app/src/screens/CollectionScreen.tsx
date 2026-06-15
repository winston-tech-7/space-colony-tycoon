import { useState } from "react";
import { api } from "../api/client";
import type { Egg, Profile } from "../types";

const EMOJI: Record<string, string> = {
  zephyr: "🟢",
  lunar: "🌙",
  nebula: "💜",
  cosmic: "✨",
};

interface Props {
  profile: Profile;
  initData: string;
  onRefresh: () => void;
}

export function CollectionScreen({ profile, initData, onRefresh }: Props) {
  const [cracking, setCracking] = useState<number | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);

  async function crackEgg(egg: Egg) {
    if (egg.status !== "ready") return;
    setCracking(egg.id);
    try {
      const result = await api<{
        creature: { name: string; rarity: string };
        species?: { emoji?: string };
      }>("/api/eggs/crack", initData, {
        method: "POST",
        body: JSON.stringify({
          eggId: egg.id,
          crackRequestId: crypto.randomUUID(),
        }),
      });
      setReveal(`${result.creature.name} · ${result.creature.rarity}`);
      onRefresh();
    } catch (e) {
      setReveal(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCracking(null);
    }
  }

  function timeLeft(readyAt: string) {
    const ms = new Date(readyAt).getTime() - Date.now();
    if (ms <= 0) return "Готово!";
    const min = Math.ceil(ms / 60000);
    return `${min} мин`;
  }

  return (
    <div className="screen collection-screen">
      <section className="panel-section">
        <h3 className="section-title">Космические яйца</h3>
        <div className="egg-list">
          {(profile.eggs ?? []).length === 0 && (
            <p className="muted">Нет яиц. Скрестите существ на базе.</p>
          )}
          {(profile.eggs ?? []).map((egg) => (
            <article key={egg.id} className="egg-card">
              <span className="egg-icon">🥚</span>
              <div>
                <strong>Яйцо #{egg.id}</strong>
                <small>
                  {egg.status === "ready"
                    ? `Редкость: ${egg.rarityTier ?? "???"}`
                    : `Инкубация: ${timeLeft(egg.readyAt)}`}
                </small>
              </div>
              <button
                type="button"
                className="primary-btn compact"
                disabled={egg.status !== "ready" || cracking === egg.id}
                onClick={() => crackEgg(egg)}
              >
                {cracking === egg.id ? "..." : "Вскрыть"}
              </button>
            </article>
          ))}
        </div>
        {reveal && <p className="win-banner">🎉 {reveal}</p>}
      </section>

      <section className="panel-section">
        <h3 className="section-title">Архив существ</h3>
        <div className="creature-grid">
          {profile.creatures.map((c) => (
            <article key={c.id} className="creature-card compact">
              <span className="creature-avatar">{EMOJI[c.speciesId] ?? "👽"}</span>
              <strong>{c.name}</strong>
              <small>{c.rarity}</small>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${c.evolutionProgress}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
