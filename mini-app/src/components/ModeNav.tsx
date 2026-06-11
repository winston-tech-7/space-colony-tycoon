import type { GameMode, GameModeId } from "../types";

interface Props {
  modes: GameMode[];
  active: GameModeId;
  onChange: (id: GameModeId) => void;
}

export function ModeNav({ modes, active, onChange }: Props) {
  return (
    <nav className="mode-nav">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`mode-btn ${active === m.id ? "active" : ""} ${!m.implemented ? "soon" : ""}`}
          onClick={() => onChange(m.id)}
        >
          <span className="mode-emoji">{m.emoji}</span>
          <span className="mode-label">{m.name.split(" ")[0]}</span>
        </button>
      ))}
    </nav>
  );
}
