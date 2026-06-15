import { GameArt } from "./GameArt";
import { MODE_LABELS } from "../lib/labels";
import type { GameModeId } from "../types";

export type HubModeId = "hub" | "battle" | "guild" | "admiral" | "expedition" | "genetic" | "storyline";

interface ModeCard {
  id: HubModeId;
  art: Parameters<typeof GameArt>[0]["kind"];
  implemented: boolean;
}

const MODE_CARDS: ModeCard[] = [
  { id: "battle", art: "battle", implemented: true },
  { id: "guild", art: "guild", implemented: true },
  { id: "admiral", art: "admiral", implemented: true },
  { id: "expedition", art: "planet", implemented: false },
  { id: "genetic", art: "breed", implemented: false },
  { id: "storyline", art: "hunt", implemented: false },
];

interface Props {
  onSelect: (mode: HubModeId) => void;
}

export function ModesHub({ onSelect }: Props) {
  return (
    <section className="panel-section modes-hub">
      <h3 className="section-title">Игровые режимы</h3>
      <div className="modes-grid">
        {MODE_CARDS.map((m) => {
          const label = MODE_LABELS[m.id as GameModeId] ?? { title: m.id, subtitle: "" };
          return (
            <button
              key={m.id}
              type="button"
              className={`mode-card ${m.implemented ? "" : "soon"}`}
              onClick={() => onSelect(m.id)}
            >
              <GameArt kind={m.art} size={52} />
              <strong>{label.title}</strong>
              <small>{m.implemented ? label.subtitle : "Скоро"}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
