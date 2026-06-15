import { PlanetCanvas } from "../components/PlanetCanvas";
import type { Profile } from "../types";

const EMOJI: Record<string, string> = {
  zephyr: "🟢",
  lunar: "🌙",
  nebula: "💜",
  cosmic: "✨",
};

const RARITY_CLASS: Record<string, string> = {
  common: "rarity-common",
  rare: "rarity-rare",
  epic: "rarity-epic",
  legendary: "rarity-legendary",
};

interface Props {
  profile: Profile;
}

export function ColonyMode({ profile }: Props) {
  const colony = profile.colonies[0];

  return (
    <div className="screen colony-screen">
      <section className="hero-card">
        <PlanetCanvas premium={colony?.isPremium} />
        <div className="hero-meta">
          <h2>{colony?.planetName ?? "Колония"}</h2>
          <span className="level-badge">Ур. {colony?.level ?? 1}</span>
          {colony?.isPremium && <span className="premium-badge">Premium</span>}
        </div>
      </section>

      <section className="stats-row">
        <div className="stat-tile">
          <span>⛏</span>
          <strong>{colony?.minerals ?? 0}</strong>
          <small>Минералы</small>
        </div>
        <div className="stat-tile">
          <span>🧬</span>
          <strong>{colony?.bioMatter ?? 0}</strong>
          <small>Биомасса</small>
        </div>
        <div className="stat-tile accent">
          <span>👽</span>
          <strong>{profile.creatures.length}</strong>
          <small>Существа</small>
        </div>
      </section>

      <section className="panel-section">
        <h3 className="section-title">Существа колонии</h3>
        <div className="creature-list">
          {profile.creatures.map((c) => (
            <article key={c.id} className="creature-card">
              <div className="creature-avatar">{EMOJI[c.speciesId] ?? "👽"}</div>
              <div className="creature-body">
                <div className="creature-head">
                  <strong>{c.name}</strong>
                  <span className={`rarity-tag ${RARITY_CLASS[c.rarity] ?? ""}`}>
                    {c.rarity}
                  </span>
                </div>
                <small className="creature-stage">{c.stage}</small>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${c.evolutionProgress}%` }}
                  />
                </div>
                <small className="progress-label">Эволюция {c.evolutionProgress}%</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
