import { PlanetCanvas } from "../components/PlanetCanvas";
import type { Profile } from "../types";

const EMOJI: Record<string, string> = {
  zephyr: "🟢",
  lunar: "🌙",
  nebula: "💜",
  cosmic: "✨",
};

interface Props {
  profile: Profile;
  status: string;
}

export function ColonyMode({ profile, status }: Props) {
  const colony = profile.colonies[0];

  return (
    <div className="mode-panel">
      <PlanetCanvas premium={colony?.isPremium} />
      <h2>{colony?.planetName ?? "Колония"} · ур. {colony?.level ?? 1}</h2>

      <div className="stats-grid">
        <div className="stat"><span>⚡</span>{colony?.energy ?? 0}</div>
        <div className="stat"><span>⛏</span>{colony?.minerals ?? 0}</div>
        <div className="stat"><span>🧬</span>{colony?.bioMatter ?? 0}</div>
        <div className="stat"><span>💰</span>{profile.credits}</div>
      </div>

      <h3>Существа</h3>
      <div className="creature-list">
        {profile.creatures.map((c) => (
          <div key={c.id} className="creature-card">
            <span className="creature-emoji">{EMOJI[c.speciesId] ?? "👽"}</span>
            <div>
              <strong>{c.name}</strong>
              <small>{c.stage} · {c.rarity}</small>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${c.evolutionProgress}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="status">{status}</p>
    </div>
  );
}
