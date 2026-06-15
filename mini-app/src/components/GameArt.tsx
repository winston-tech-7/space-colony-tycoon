type ArtKind =
  | "battle"
  | "guild"
  | "admiral"
  | "market"
  | "wheel"
  | "hunt"
  | "breed"
  | "creature-zephyr"
  | "creature-lunar"
  | "creature-nebula"
  | "creature-cosmic"
  | "planet";

interface Props {
  kind: ArtKind;
  className?: string;
  size?: number;
}

export function GameArt({ kind, className = "", size = 64 }: Props) {
  const s = size;
  const common = { width: s, height: s, className: `game-art ${className}`, viewBox: "0 0 64 64" };

  switch (kind) {
    case "battle":
      return (
        <svg {...common} aria-hidden>
          <defs>
            <linearGradient id="battle-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff6b6b" />
              <stop offset="100%" stopColor="#9f7bff" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill="#1a2238" stroke="url(#battle-g)" strokeWidth="2" />
          <path d="M18 40 L32 16 L46 40 Z" fill="url(#battle-g)" opacity="0.9" />
          <rect x="28" y="38" width="8" height="14" rx="2" fill="#ffc107" />
        </svg>
      );
    case "guild":
      return (
        <svg {...common} aria-hidden>
          <circle cx="32" cy="32" r="30" fill="#1a2238" stroke="#5b8cff" strokeWidth="2" />
          <path d="M32 12 L42 22 L38 44 H26 L22 22 Z" fill="#5b8cff" opacity="0.85" />
          <circle cx="32" cy="28" r="6" fill="#ffc107" />
        </svg>
      );
    case "admiral":
      return (
        <svg {...common} aria-hidden>
          <circle cx="32" cy="32" r="30" fill="#1a2238" stroke="#26c6da" strokeWidth="2" />
          <ellipse cx="32" cy="36" rx="18" ry="8" fill="#26c6da" opacity="0.5" />
          <ellipse cx="32" cy="28" rx="12" ry="14" fill="#9f7bff" />
          <circle cx="28" cy="26" r="2" fill="#fff" />
          <circle cx="36" cy="26" r="2" fill="#fff" />
        </svg>
      );
    case "market":
      return (
        <svg {...common} aria-hidden>
          <rect x="8" y="20" width="48" height="32" rx="6" fill="#1a2238" stroke="#ffc107" strokeWidth="2" />
          <path d="M8 28 H56" stroke="#ffc107" strokeWidth="1.5" opacity="0.5" />
          <circle cx="22" cy="38" r="6" fill="#5b8cff" />
          <rect x="34" y="34" width="14" height="8" rx="2" fill="#26c6da" />
        </svg>
      );
    case "wheel":
      return (
        <svg {...common} aria-hidden>
          <circle cx="32" cy="32" r="28" fill="#1a2238" stroke="#ffc107" strokeWidth="2" />
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <line
              key={deg}
              x1="32"
              y1="32"
              x2={32 + 24 * Math.cos((deg * Math.PI) / 180)}
              y2={32 + 24 * Math.sin((deg * Math.PI) / 180)}
              stroke={i % 2 ? "#5b8cff" : "#9f7bff"}
              strokeWidth="2"
            />
          ))}
          <circle cx="32" cy="32" r="6" fill="#ffc107" />
        </svg>
      );
    case "hunt":
      return (
        <svg {...common} aria-hidden>
          <circle cx="32" cy="32" r="28" fill="#1a2238" stroke="#ff6b6b" strokeWidth="2" />
          <circle cx="32" cy="32" r="16" fill="none" stroke="#ff6b6b" strokeWidth="2" opacity="0.6" />
          <circle cx="32" cy="32" r="6" fill="#ff6b6b" />
          <line x1="32" y1="4" x2="32" y2="14" stroke="#ffc107" strokeWidth="2" />
        </svg>
      );
    case "breed":
      return (
        <svg {...common} aria-hidden>
          <circle cx="32" cy="32" r="28" fill="#1a2238" stroke="#9f7bff" strokeWidth="2" />
          <path d="M20 36 Q32 14 44 36" fill="none" stroke="#26c6da" strokeWidth="3" />
          <circle cx="22" cy="34" r="5" fill="#5b8cff" />
          <circle cx="42" cy="34" r="5" fill="#9f7bff" />
        </svg>
      );
    case "planet":
      return (
        <svg {...common} aria-hidden>
          <circle cx="32" cy="34" r="18" fill="#5b8cff" />
          <ellipse cx="32" cy="34" rx="22" ry="6" fill="none" stroke="#26c6da" strokeWidth="2" opacity="0.7" />
          <circle cx="24" cy="28" r="4" fill="#1a6b3a" opacity="0.8" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden>
          <CreatureBlob species={kind.replace("creature-", "")} />
        </svg>
      );
  }
}

function CreatureBlob({ species }: { species: string }) {
  const colors: Record<string, string> = {
    zephyr: "#4ade80",
    lunar: "#93c5fd",
    nebula: "#c084fc",
    cosmic: "#fcd34d",
  };
  const fill = colors[species] ?? "#5b8cff";
  return (
    <>
      <circle cx="32" cy="32" r="28" fill="#1a2238" stroke={fill} strokeWidth="2" />
      <ellipse cx="32" cy="34" rx="14" ry="16" fill={fill} opacity="0.9" />
      <circle cx="26" cy="28" r="3" fill="#0a0e17" />
      <circle cx="38" cy="28" r="3" fill="#0a0e17" />
    </>
  );
}

export function creatureArtKind(speciesId: string): ArtKind {
  const map: Record<string, ArtKind> = {
    zephyr: "creature-zephyr",
    lunar: "creature-lunar",
    nebula: "creature-nebula",
    cosmic: "creature-cosmic",
  };
  return map[speciesId] ?? "creature-zephyr";
}
