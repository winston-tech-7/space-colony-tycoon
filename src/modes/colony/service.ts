import { Rarity, Stage } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { claimIdempotencyKey } from "../../db/idempotency.js";
import { bumpQuest } from "../loop/quests.js";
import { publishEvent } from "../../realtime/events.js";
import { computeColonyYield } from "../planets/catalog.js";

export const SPECIES = [
  { id: "zephyr", name: "Zephyr Mite", rarity: Rarity.common, emoji: "🟢" },
  { id: "lunar", name: "Lunar Crawler", rarity: Rarity.uncommon, emoji: "🌙" },
  { id: "nebula", name: "Nebula Wisp", rarity: Rarity.rare, emoji: "💜" },
  { id: "cosmic", name: "Cosmic Drake", rarity: Rarity.legendary, emoji: "✨" },
] as const;

const STAGE_ORDER: Stage[] = [
  Stage.egg,
  Stage.juvenile,
  Stage.adult,
  Stage.evolved,
];

const STARTER_PLANET = { id: "starter", name: "Kepler-442b" };

export function speciesById(id: string) {
  return SPECIES.find((s) => s.id === id);
}

function idleYield(
  colony: { planetId: string; mineLevel: number; bioLabLevel: number; isPremium: boolean },
  minutes: number,
) {
  return computeColonyYield(colony, minutes);
}

export async function ensureUser(
  telegramId: bigint,
  firstName: string,
  username?: string,
) {
  const user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      firstName,
      username: username ?? null,
      referralCode: `ref_${telegramId}`,
    },
    update: { firstName, username: username ?? null, lastSeenAt: new Date() },
    include: {
      colonies: { include: { creatures: true } },
      creatures: true,
    },
  });

  if (user.colonies.length === 0) {
    await createStarterColony(telegramId);
    return ensureUser(telegramId, firstName, username);
  }

  await collectIdleResources(telegramId);
  return getProfile(telegramId);
}

async function createStarterColony(telegramId: bigint) {
  const starter = SPECIES[0];
  const colony = await prisma.colony.create({
    data: {
      userId: telegramId,
      planetId: STARTER_PLANET.id,
      planetName: STARTER_PLANET.name,
      energy: 100,
      minerals: 10,
      bioMatter: 5,
    },
  });

  await prisma.creature.create({
    data: {
      ownerId: telegramId,
      colonyId: colony.id,
      speciesId: starter.id,
      name: starter.name,
      rarity: starter.rarity,
      stage: Stage.egg,
      hunger: 40,
    },
  });

  await publishEvent(Number(telegramId), "colony_created", {
    planetId: STARTER_PLANET.id,
  });
}

export async function getProfile(telegramId: bigint) {
  return prisma.user.findUnique({
    where: { telegramId },
    include: {
      colonies: { include: { creatures: true }, orderBy: { id: "asc" } },
      creatures: { where: { listed: false }, orderBy: { id: "asc" } },
      eggs: { where: { status: { not: "opened" } }, orderBy: { createdAt: "desc" } },
      guildMemberships: { include: { guild: true } },
    },
  });
}

export async function collectIdleResources(telegramId: bigint) {
  const colonies = await prisma.colony.findMany({ where: { userId: telegramId } });
  const now = Date.now();

  for (const colony of colonies) {
    if (colony.energy < 0) {
      await prisma.colony.update({
        where: { id: colony.id },
        data: { energy: 0 },
      });
      colony.energy = 0;
    }

    const minutes = Math.floor((now - colony.lastCollected.getTime()) / 60_000);
    if (minutes < 1) continue;

    const yield_ = idleYield(colony, minutes);
    await prisma.colony.update({
      where: { id: colony.id },
      data: {
        energy: Math.min(100, colony.energy + yield_.energy),
        minerals: colony.minerals + yield_.minerals,
        bioMatter: colony.bioMatter + yield_.bioMatter,
        lastCollected: new Date(),
      },
    });
  }
}

export async function feedCreatures(telegramId: bigint) {
  const allowed = await claimIdempotencyKey(telegramId, "feed", 60);
  if (!allowed) {
    throw new Error("Кормление доступно раз в минуту");
  }

  const creatures = await prisma.creature.findMany({
    where: { ownerId: telegramId, listed: false, status: "active" },
  });

  let fed = 0;
  let evolved = 0;
  const now = new Date();

  for (const creature of creatures) {
    const hunger = Math.max(0, creature.hunger - 25);
    let progress = Math.min(100, creature.evolutionProgress + 20);
    let stage = creature.stage;

    if (progress >= 100 && stage !== Stage.evolved) {
      const idx = STAGE_ORDER.indexOf(stage);
      if (idx < STAGE_ORDER.length - 1) {
        stage = STAGE_ORDER[idx + 1];
        progress = 0;
        evolved += 1;
      } else {
        progress = 100;
      }
    }

    await prisma.creature.update({
      where: { id: creature.id },
      data: {
        hunger,
        evolutionProgress: progress,
        stage,
        feedCount: { increment: 1 },
        lastFedAt: now,
      },
    });
    fed += 1;
  }

  const medalBonus = Math.floor(fed / 10);

  await prisma.user.update({
    where: { telegramId },
    data: {
      totalFeeds: { increment: fed },
      medals: medalBonus > 0 ? { increment: medalBonus } : undefined,
    },
  });

  const colonies = await prisma.colony.findMany({ where: { userId: telegramId } });
  for (const colony of colonies) {
    await prisma.colony.update({
      where: { id: colony.id },
      data: { energy: Math.max(0, colony.energy - 5) },
    });
  }

  await bumpQuest(telegramId, "daily_feed", 1);
  await publishEvent(Number(telegramId), "creatures_fed", { fed, evolved });

  return { fed, evolved, profile: await getProfile(telegramId) };
}

export async function getRareCreatures(telegramId: bigint) {
  const creatures = await prisma.creature.findMany({
    where: {
      ownerId: telegramId,
      rarity: { in: [Rarity.rare, Rarity.legendary] },
      listed: false,
    },
  });

  return creatures.map((c) => ({
    creature: c,
    species: speciesById(c.speciesId) ?? SPECIES[0],
  }));
}

export function formatColonyStatus(
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>,
): string {
  const colony = profile.colonies[0];
  if (!colony) return "Колония не найдена. Нажмите /start.";

  const creatureLines = profile.creatures
    .slice(0, 5)
    .map((c) => {
      const sp = speciesById(c.speciesId);
      const bar =
        "█".repeat(Math.floor(c.evolutionProgress / 10)) +
        "░".repeat(10 - Math.floor(c.evolutionProgress / 10));
      return `${sp?.emoji ?? "👽"} *${c.name}* (${c.stage})\n   \`${bar}\` ${c.evolutionProgress}%`;
    })
    .join("\n\n");

  return (
    `🪐 *${colony.planetName}* · ур. ${colony.level}\n` +
    `⚡ ${colony.energy} · ⛏ ${colony.minerals} · 🧬 ${colony.bioMatter}\n` +
    `💰 Кредиты: ${profile.credits}\n\n` +
    `*Существа:*\n${creatureLines || "_Пока пусто_"}`
  );
}

export function computePowerRating(
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>,
): number {
  const rarityScore: Record<Rarity, number> = {
    common: 1,
    uncommon: 3,
    rare: 8,
    legendary: 20,
  };

  const creaturePower = profile.creatures.reduce(
    (sum, c) =>
      sum +
      rarityScore[c.rarity] +
      STAGE_ORDER.indexOf(c.stage) +
      (c.powerLevel ?? 1) * 2,
    0,
  );
  const colonyPower = profile.colonies.reduce(
    (sum, c) =>
      sum + c.level * 5 + (c.mineLevel ?? 1) * 3 + (c.bioLabLevel ?? 1) * 2,
    0,
  );
  return creaturePower + colonyPower;
}
