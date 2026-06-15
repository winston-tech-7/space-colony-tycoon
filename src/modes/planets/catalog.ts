export type PlanetDef = {
  id: string;
  name: string;
  type: string;
  emoji: string;
  defense: number;
  unlockCredits: number;
  unlockMinerals: number;
  mineRate: number;
  bioRate: number;
  raidRewardMinerals: number;
  raidRewardBio: number;
};

/** Каталог планет: шахта даёт минералы, биолаб — биомассу */
export const PLANET_CATALOG: PlanetDef[] = [
  {
    id: "starter",
    name: "Kepler-442b",
    type: "terran",
    emoji: "🌍",
    defense: 0,
    unlockCredits: 0,
    unlockMinerals: 0,
    mineRate: 1,
    bioRate: 1,
    raidRewardMinerals: 0,
    raidRewardBio: 0,
  },
  {
    id: "proxima",
    name: "Proxima b",
    type: "rocky",
    emoji: "🪨",
    defense: 15,
    unlockCredits: 120,
    unlockMinerals: 250,
    mineRate: 1.4,
    bioRate: 1.1,
    raidRewardMinerals: 80,
    raidRewardBio: 40,
  },
  {
    id: "trappist",
    name: "TRAPPIST-1e",
    type: "ocean",
    emoji: "🌊",
    defense: 28,
    unlockCredits: 300,
    unlockMinerals: 600,
    mineRate: 1.8,
    bioRate: 1.5,
    raidRewardMinerals: 150,
    raidRewardBio: 100,
  },
  {
    id: "europa",
    name: "Europa Prime",
    type: "ice",
    emoji: "❄️",
    defense: 45,
    unlockCredits: 600,
    unlockMinerals: 1200,
    mineRate: 2.2,
    bioRate: 1.3,
    raidRewardMinerals: 280,
    raidRewardBio: 80,
  },
  {
    id: "titan",
    name: "Titan Deep",
    type: "gas",
    emoji: "🪐",
    defense: 65,
    unlockCredits: 1000,
    unlockMinerals: 2000,
    mineRate: 2.8,
    bioRate: 2,
    raidRewardMinerals: 450,
    raidRewardBio: 200,
  },
];

export function getPlanetDef(planetId: string): PlanetDef | undefined {
  return PLANET_CATALOG.find((p) => p.id === planetId);
}

export function mineUpgradeCost(level: number): number {
  return level * 60;
}

export function bioLabUpgradeCost(level: number): number {
  return level * 50;
}

export function creatureUpgradeCost(powerLevel: number): {
  minerals: number;
  bioMatter: number;
} {
  return { minerals: 35 + powerLevel * 25, bioMatter: 25 + powerLevel * 20 };
}

export function eggBoostCost(boostLevel: number): number {
  return 30 + boostLevel * 25;
}

export function computeColonyYield(
  colony: {
    planetId: string;
    mineLevel: number;
    bioLabLevel: number;
    isPremium: boolean;
  },
  minutes: number,
) {
  const def = getPlanetDef(colony.planetId);
  const mult = colony.isPremium ? 2 : 1;
  const planetMine = def?.mineRate ?? 1;
  const planetBio = def?.bioRate ?? 1;
  const mineMult = 1 + (colony.mineLevel - 1) * 0.35;
  const bioMult = 1 + (colony.bioLabLevel - 1) * 0.3;

  return {
    energy: Math.min(100, Math.floor(minutes * 0.5 * mult)),
    minerals: Math.floor(minutes * 0.45 * mult * planetMine * mineMult),
    bioMatter: Math.floor(minutes * 0.3 * mult * planetBio * bioMult),
  };
}
