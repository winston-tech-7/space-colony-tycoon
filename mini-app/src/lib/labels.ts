export const STAGE_LABELS: Record<string, string> = {
  egg: "Яйцо",
  juvenile: "Молодое",
  adult: "Взрослое",
  evolved: "Эволюция",
};

export const RARITY_LABELS: Record<string, string> = {
  common: "Обычное",
  uncommon: "Необычное",
  rare: "Редкое",
  legendary: "Легендарное",
};

export const MODE_LABELS: Record<string, { title: string; subtitle: string }> = {
  battle: { title: "Арена битв", subtitle: "Пошаговые PvP-сражения" },
  guild: { title: "Гильдии", subtitle: "Альянсы и сезонные войны" },
  admiral: { title: "Адмирал ИИ", subtitle: "Советы по стратегии" },
  expedition: { title: "Экспедиции", subtitle: "Скоро: кооп-миссии" },
  genetic: { title: "Генетическая лаборатория", subtitle: "Скоро: уникальные виды" },
  storyline: { title: "Сюжетные квесты", subtitle: "Скоро: кампании" },
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function rarityLabel(rarity: string): string {
  return RARITY_LABELS[rarity] ?? rarity;
}

export function newRequestId(prefix = "req"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
