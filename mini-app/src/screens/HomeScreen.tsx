import { useState } from "react";
import { api } from "../api/client";
import { PlanetCanvas } from "../components/PlanetCanvas";
import { PlanetsPanel } from "../components/PlanetsPanel";
import type { Profile } from "../types";

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
  onNavigate: (tab: "collection" | "events") => void;
}

export function HomeScreen({ profile, initData, onRefresh, onNavigate }: Props) {
  const [breedOpen, setBreedOpen] = useState(false);
  const [parentA, setParentA] = useState<number | null>(null);
  const [parentB, setParentB] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<
    Array<{ id: number; name: string; rarity: string; owner: { firstName: string } }>
  >([]);
  const [msg, setMsg] = useState("");

  const colony = profile.colonies[0];
  const mainCreature = profile.creatures[0];
  const readyEggs = profile.eggs?.filter((e) => e.status === "ready").length ?? 0;

  async function openBreed() {
    setBreedOpen(true);
    const data = await api<{ candidates: typeof candidates }>(
      "/api/breed/candidates",
      initData,
    );
    setCandidates(data.candidates);
    const adults = profile.creatures.filter((c) =>
      ["adult", "evolved"].includes(c.stage),
    );
    setParentA(adults[0]?.id ?? null);
  }

  async function confirmBreed() {
    if (!parentA || !parentB) return;
    try {
      const sessionId = crypto.randomUUID();
      await api("/api/breed", initData, {
        method: "POST",
        body: JSON.stringify({ sessionId, parentAId: parentA, parentBId: parentB }),
      });
      setMsg("Космическое яйцо в инкубаторе!");
      setBreedOpen(false);
      onRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="screen home-screen">
      <section className="hero-card">
        <PlanetCanvas premium={colony?.isPremium} />
        <div className="hero-meta">
          <h2>{colony?.planetName ?? "Колония"}</h2>
          <span className="level-badge">Ур. {colony?.level ?? 1}</span>
        </div>
        {mainCreature && (
          <div className="main-creature">
            <span className="creature-avatar lg">
              {EMOJI[mainCreature.speciesId] ?? "👽"}
            </span>
            <strong>{mainCreature.name}</strong>
            <small>{mainCreature.stage} · {mainCreature.rarity}</small>
          </div>
        )}
      </section>

      <section className="action-grid">
        <button type="button" className="action-tile" onClick={() => onNavigate("collection")}>
          <span>🥚</span>
          <strong>Яйца</strong>
          <small>{readyEggs} готово</small>
        </button>
        <button type="button" className="action-tile" onClick={openBreed}>
          <span>🧬</span>
          <strong>Скрещивание</strong>
          <small>50 💰</small>
        </button>
        <button type="button" className="action-tile" onClick={() => onNavigate("events")}>
          <span>🎡</span>
          <strong>Рулетка</strong>
          <small>100 🏅</small>
        </button>
        <button type="button" className="action-tile" onClick={() => onNavigate("events")}>
          <span>🎯</span>
          <strong>Охота</strong>
          <small>Легенда</small>
        </button>
      </section>

      <section className="stats-row">
        <div className="stat-tile" title="Добываются шахтой на планетах и рейдах">
          <span>⛏</span><strong>{colony?.minerals ?? 0}</strong><small>Минералы</small>
        </div>
        <div className="stat-tile" title="Добывается биолабом, тратится на прокачку">
          <span>🧬</span><strong>{colony?.bioMatter ?? 0}</strong><small>Биомасса</small>
        </div>
        <div className="stat-tile accent"><span>👽</span><strong>{profile.creatures.length}</strong><small>Существа</small></div>
      </section>

      <PlanetsPanel initData={initData} colonyId={colony?.id} onRefresh={onRefresh} />

      {msg && <p className="status toast">{msg}</p>}

      {breedOpen && (
        <div className="modal-sheet">
          <h3>Скрещивание существ</h3>
          <label className="form-block">
            Ваше существо
            <select
              value={parentA ?? ""}
              onChange={(e) => setParentA(Number(e.target.value))}
            >
              {profile.creatures
                .filter((c) => ["adult", "evolved"].includes(c.stage))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </label>
          <label className="form-block">
            Партнёр из колонии
            <select
              value={parentB ?? ""}
              onChange={(e) => setParentB(Number(e.target.value))}
            >
              <option value="">Выберите...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.owner.firstName})
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary-btn" onClick={confirmBreed}>
            Создать яйцо
          </button>
          <button type="button" className="secondary-btn" onClick={() => setBreedOpen(false)}>
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
