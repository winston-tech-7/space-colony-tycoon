export type GameModeId =
  | "colony"
  | "guild"
  | "trading"
  | "battle"
  | "expedition"
  | "genetic"
  | "admiral"
  | "storyline";

export interface GameMode {
  id: GameModeId;
  name: string;
  emoji: string;
  phase: 1 | 2 | 3 | 4;
  implemented: boolean;
  deepLink: string;
  description: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: "colony",
    name: "Colony Builder",
    emoji: "🏭",
    phase: 1,
    implemented: true,
    deepLink: "colony",
    description: "Строительство колонии, разведение существ, сбор ресурсов",
  },
  {
    id: "guild",
    name: "Guild Wars",
    emoji: "⚔️",
    phase: 2,
    implemented: true,
    deepLink: "guild",
    description: "Альянсы 20–50 игроков, еженедельные сезоны",
  },
  {
    id: "trading",
    name: "Trading Hub",
    emoji: "🏪",
    phase: 1,
    implemented: true,
    deepLink: "market",
    description: "P2P маркетплейс существ и ресурсов",
  },
  {
    id: "battle",
    name: "Battle Arena",
    emoji: "🥊",
    phase: 2,
    implemented: true,
    deepLink: "battle",
    description: "Turn-based PvP битвы существ",
  },
  {
    id: "expedition",
    name: "Expedition Mode",
    emoji: "🚀",
    phase: 3,
    implemented: false,
    deepLink: "expedition",
    description: "Кооперативные миссии 2–4 игрока",
  },
  {
    id: "genetic",
    name: "Genetic Lab",
    emoji: "🧬",
    phase: 3,
    implemented: false,
    deepLink: "genetic",
    description: "NFT-крафтинг уникальных видов",
  },
  {
    id: "admiral",
    name: "AI Admiral",
    emoji: "🤖",
    phase: 3,
    implemented: true,
    deepLink: "admiral",
    description: "GPT-советник по стратегии",
  },
  {
    id: "storyline",
    name: "Storyline Quests",
    emoji: "📖",
    phase: 3,
    implemented: false,
    deepLink: "storyline",
    description: "Нарративные кампании с выборами",
  },
];

export function modeById(id: string): GameMode | undefined {
  return GAME_MODES.find((m) => m.id === id || m.deepLink === id);
}

export function parseStartApp(param?: string): {
  mode: GameModeId;
  payload?: string;
} {
  if (!param) return { mode: "colony" };

  if (param.startsWith("join_")) {
    return { mode: "guild", payload: param.replace("join_", "") };
  }
  if (param.startsWith("challenge_")) {
    return { mode: "battle", payload: param.replace("challenge_", "") };
  }
  if (param.startsWith("nft_")) {
    return { mode: "trading", payload: param };
  }
  if (param.startsWith("expedition_")) {
    return { mode: "expedition", payload: param.replace("expedition_", "") };
  }

  const mode = modeById(param);
  if (mode) return { mode: mode.id, payload: param };

  return { mode: "colony", payload: param };
}
