import type { GameModeId } from "./registry.js";

export interface StubModeResponse {
  mode: GameModeId;
  status: "coming_soon";
  phase: number;
  message: string;
  integrationHint: string;
}

const STUB_MESSAGES: Record<string, StubModeResponse> = {
  expedition: {
    mode: "expedition",
    status: "coming_soon",
    phase: 3,
    message: "Expedition Mode — кооп миссии на процедурные планеты",
    integrationHint:
      "Используйте таблицы expeditions + expedition_participants из Prisma",
  },
  genetic: {
    mode: "genetic",
    status: "coming_soon",
    phase: 3,
    message: "Genetic Lab — скрещивание существ и NFT на TON",
    integrationHint:
      "Подключите tonweb + nft_metadata, traits_json на creatures",
  },
  storyline: {
    mode: "storyline",
    status: "coming_soon",
    phase: 3,
    message: "Storyline Quests — ветвящиеся кампании",
    integrationHint:
      "Добавьте quests JSON + seasonal_progress для наград",
  },
};

export function getStubMode(mode: GameModeId): StubModeResponse | null {
  return STUB_MESSAGES[mode] ?? null;
}
