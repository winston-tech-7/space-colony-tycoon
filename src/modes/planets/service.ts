import { prisma } from "../../db/prisma.js";
import { getProfile, computePowerRating } from "../colony/service.js";
import {
  PLANET_CATALOG,
  getPlanetDef,
  mineUpgradeCost,
  bioLabUpgradeCost,
  creatureUpgradeCost,
  eggBoostCost,
} from "./catalog.js";

export { computeColonyYield } from "./catalog.js";

async function requireProfile(userId: bigint) {
  const profile = await getProfile(userId);
  if (!profile) throw new Error("Профиль не найден");
  return profile;
}

export async function getPlanetEconomy(userId: bigint) {
  const profile = await requireProfile(userId);
  const ownedIds = new Set(profile.colonies.map((c) => c.planetId));

  const catalog = PLANET_CATALOG.map((p) => {
    const colony = profile.colonies.find((c) => c.planetId === p.id);
    return {
      ...p,
      owned: ownedIds.has(p.id),
      colonyId: colony?.id ?? null,
      mineLevel: colony?.mineLevel ?? 1,
      bioLabLevel: colony?.bioLabLevel ?? 1,
      minerals: colony?.minerals ?? 0,
      bioMatter: colony?.bioMatter ?? 0,
      nextMineCost: colony ? mineUpgradeCost(colony.mineLevel) : null,
      nextBioCost: colony ? bioLabUpgradeCost(colony.bioLabLevel) : null,
    };
  });

  return {
    playerPower: computePowerRating(profile),
    totalMinerals: profile.colonies.reduce((s, c) => s + c.minerals, 0),
    totalBioMatter: profile.colonies.reduce((s, c) => s + c.bioMatter, 0),
    credits: profile.credits,
    catalog,
  };
}

export async function upgradeMine(userId: bigint, colonyId: number) {
  const colony = await prisma.colony.findFirst({
    where: { id: colonyId, userId },
  });
  if (!colony) throw new Error("Колония не найдена");

  const cost = mineUpgradeCost(colony.mineLevel);
  if (colony.minerals < cost) {
    throw new Error(`Нужно ${cost} минералов (есть ${colony.minerals})`);
  }

  await prisma.colony.update({
    where: { id: colonyId },
    data: {
      minerals: colony.minerals - cost,
      mineLevel: colony.mineLevel + 1,
    },
  });

  return getPlanetEconomy(userId);
}

export async function upgradeBioLab(userId: bigint, colonyId: number) {
  const colony = await prisma.colony.findFirst({
    where: { id: colonyId, userId },
  });
  if (!colony) throw new Error("Колония не найдена");

  const cost = bioLabUpgradeCost(colony.bioLabLevel);
  if (colony.bioMatter < cost) {
    throw new Error(`Нужно ${cost} биомассы (есть ${colony.bioMatter})`);
  }

  await prisma.colony.update({
    where: { id: colonyId },
    data: {
      bioMatter: colony.bioMatter - cost,
      bioLabLevel: colony.bioLabLevel + 1,
    },
  });

  return getPlanetEconomy(userId);
}

export async function unlockPlanet(userId: bigint, planetId: string) {
  const def = getPlanetDef(planetId);
  if (!def) throw new Error("Неизвестная планета");
  if (def.defense === 0) throw new Error("Стартовая планета уже открыта");

  const existing = await prisma.colony.findUnique({
    where: { userId_planetId: { userId, planetId } },
  });
  if (existing) throw new Error("Планета уже ваша");

  const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: userId } });
  if (user.credits < def.unlockCredits) {
    throw new Error(`Нужно ${def.unlockCredits} кредитов`);
  }

  const colonies = await prisma.colony.findMany({ where: { userId } });
  const totalMinerals = colonies.reduce((s, c) => s + c.minerals, 0);
  if (totalMinerals < def.unlockMinerals) {
    throw new Error(`Нужно ${def.unlockMinerals} минералов (всего ${totalMinerals})`);
  }

  // Списываем минералы с самой богатой колонии
  let remaining = def.unlockMinerals;
  const sorted = [...colonies].sort((a, b) => b.minerals - a.minerals);
  for (const c of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(c.minerals, remaining);
    await prisma.colony.update({
      where: { id: c.id },
      data: { minerals: c.minerals - take },
    });
    remaining -= take;
  }

  await prisma.user.update({
    where: { telegramId: userId },
    data: { credits: user.credits - def.unlockCredits },
  });

  await prisma.colony.create({
    data: {
      userId,
      planetId: def.id,
      planetName: def.name,
      planetType: def.type,
      minerals: 20,
      bioMatter: 10,
      mineLevel: 1,
      bioLabLevel: 1,
    },
  });

  return getPlanetEconomy(userId);
}

export async function raidPlanet(userId: bigint, planetId: string) {
  const def = getPlanetDef(planetId);
  if (!def) throw new Error("Неизвестная планета");
  if (def.defense === 0) throw new Error("Нельзя атаковать стартовую планету");

  const profile = await requireProfile(userId);
  const power = computePowerRating(profile);
  const owned = profile.colonies.some((c) => c.planetId === planetId);

  if (owned) throw new Error("Планета уже под вашим контролем");

  const winThreshold = def.defense * 1.1;
  const won = power >= winThreshold || Math.random() < power / (def.defense * 2);

  const mainColony = profile.colonies[0];
  if (!mainColony) throw new Error("Нет колонии");

  if (won) {
    await prisma.colony.update({
      where: { id: mainColony.id },
      data: {
        minerals: mainColony.minerals + def.raidRewardMinerals,
        bioMatter: mainColony.bioMatter + def.raidRewardBio,
      },
    });

    return {
      won: true,
      message: `Победа! +${def.raidRewardMinerals} ⛏️ +${def.raidRewardBio} 🧬`,
      rewardMinerals: def.raidRewardMinerals,
      rewardBio: def.raidRewardBio,
      unlockDiscount: 0.5,
      economy: await getPlanetEconomy(userId),
    };
  }

  const energyLoss = 15;
  await prisma.colony.update({
    where: { id: mainColony.id },
    data: { energy: Math.max(0, mainColony.energy - energyLoss) },
  });

  return {
    won: false,
    message: `Поражение. Нужна сила ≥${Math.ceil(winThreshold)} (у вас ${power}). −${energyLoss} энергии.`,
    economy: await getPlanetEconomy(userId),
  };
}

export async function upgradeCreature(userId: bigint, creatureId: number) {
  const creature = await prisma.creature.findFirst({
    where: { id: creatureId, ownerId: userId, status: "active" },
    include: { colony: true },
  });
  if (!creature) throw new Error("Существо не найдено");
  if (creature.powerLevel >= 20) throw new Error("Максимальный уровень силы");

  const cost = creatureUpgradeCost(creature.powerLevel);
  if (creature.colony.minerals < cost.minerals) {
    throw new Error(`Нужно ${cost.minerals} минералов`);
  }
  if (creature.colony.bioMatter < cost.bioMatter) {
    throw new Error(`Нужно ${cost.bioMatter} биомассы`);
  }

  await prisma.colony.update({
    where: { id: creature.colonyId },
    data: {
      minerals: creature.colony.minerals - cost.minerals,
      bioMatter: creature.colony.bioMatter - cost.bioMatter,
    },
  });

  await prisma.creature.update({
    where: { id: creatureId },
    data: { powerLevel: creature.powerLevel + 1 },
  });

  return getProfile(userId);
}

export async function upgradeEgg(userId: bigint, eggId: number) {
  const egg = await prisma.egg.findFirst({
    where: { id: eggId, ownerId: userId, status: "incubating" },
  });
  if (!egg) throw new Error("Яйцо не найдено или уже вскрыто");
  if (egg.boostLevel >= 5) throw new Error("Максимальный буст инкубации");

  const profile = await requireProfile(userId);
  const colony = profile.colonies[0];
  if (!colony) throw new Error("Нет колонии");

  const cost = eggBoostCost(egg.boostLevel);
  if (colony.bioMatter < cost) {
    throw new Error(`Нужно ${cost} биомассы (есть ${colony.bioMatter})`);
  }

  const now = Date.now();
  const readyMs = egg.readyAt.getTime();
  const remaining = Math.max(0, readyMs - now);
  const newRemaining = Math.floor(remaining * 0.65);
  const newReadyAt = new Date(now + newRemaining);

  await prisma.colony.update({
    where: { id: colony.id },
    data: { bioMatter: colony.bioMatter - cost },
  });

  await prisma.egg.update({
    where: { id: eggId },
    data: {
      boostLevel: egg.boostLevel + 1,
      readyAt: newReadyAt,
    },
  });

  return getProfile(userId);
}
