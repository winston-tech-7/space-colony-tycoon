import { EggStatus, HuntEventStatus, Rarity, Stage } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { SPECIES, speciesById } from "../colony/service.js";
import { bumpQuest } from "./quests.js";

const BREED_COST = 50;
const INCUBATION_MS = 3 * 60 * 1000;
const WHEEL_COST = 100;

const WHEEL_PRIZES = [
  { id: "credits_50", weight: 30, label: "+50 кредитов", credits: 50 },
  { id: "medals_25", weight: 25, label: "+25 медалей", medals: 25 },
  { id: "tokens_5", weight: 20, label: "+5 токенов", tokens: 5 },
  { id: "egg_bonus", weight: 15, label: "Космическое яйцо", egg: true },
  { id: "credits_200", weight: 10, label: "+200 кредитов", credits: 200 },
] as const;

function pickRarity(seed: number): Rarity {
  const roll = seed % 100;
  if (roll < 3) return Rarity.legendary;
  if (roll < 15) return Rarity.rare;
  if (roll < 40) return Rarity.uncommon;
  return Rarity.common;
}

function pickWheelPrize(seed: number) {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let roll = seed % total;
  for (const prize of WHEEL_PRIZES) {
    roll -= prize.weight;
    if (roll < 0) return prize;
  }
  return WHEEL_PRIZES[0];
}

function speciesForRarity(rarity: Rarity) {
  const pool = SPECIES.filter((s) => s.rarity === rarity);
  return pool[0] ?? SPECIES[0];
}

export async function syncEggStatuses(userId: bigint): Promise<void> {
  const incubating = await prisma.egg.findMany({
    where: { ownerId: userId, status: EggStatus.incubating },
  });

  const now = Date.now();
  for (const egg of incubating) {
    if (egg.readyAt.getTime() <= now) {
      const rarityTier =
        egg.rarityTier ?? pickRarity(egg.id * 997 + Number(userId));
      await prisma.egg.update({
        where: { id: egg.id },
        data: { status: EggStatus.ready, rarityTier },
      });
    }
  }
}

export async function listEggs(userId: bigint) {
  await syncEggStatuses(userId);
  return prisma.egg.findMany({
    where: { ownerId: userId, status: { not: EggStatus.opened } },
    orderBy: { createdAt: "desc" },
  });
}

export async function breedCreatures(
  userId: bigint,
  sessionId: string,
  parentAId: number,
  parentBId: number,
) {
  const existing = await prisma.breedingSession.findUnique({
    where: { id: sessionId },
    include: { egg: true },
  });
  if (existing?.egg) return { egg: existing.egg, reused: true };

  return prisma.$transaction(async (tx) => {
    const dup = await tx.breedingSession.findUnique({ where: { id: sessionId } });
    if (dup?.eggId) {
      const egg = await tx.egg.findUnique({ where: { id: dup.eggId } });
      return { egg, reused: true };
    }

    const [parentA, parentB, user] = await Promise.all([
      tx.creature.findFirst({
        where: { id: parentAId, ownerId: userId, listed: false, status: "active" },
      }),
      tx.creature.findFirst({
        where: { id: parentBId, listed: false, status: "active" },
      }),
      tx.user.findUnique({ where: { telegramId: userId } }),
    ]);

    if (!parentA || !parentB) throw new Error("Существо недоступно для скрещивания");
    if (parentA.id === parentB.id) throw new Error("Нужны два разных существа");
    if (!user || user.credits < BREED_COST) throw new Error("Недостаточно кредитов");

    const readyAt = new Date(Date.now() + INCUBATION_MS);
    const egg = await tx.egg.create({
      data: {
        ownerId: userId,
        parentAId: parentA.id,
        parentBId: parentB.id,
        readyAt,
      },
    });

    await tx.user.update({
      where: { telegramId: userId },
      data: { credits: { decrement: BREED_COST } },
    });

    await tx.breedingSession.create({
      data: {
        id: sessionId,
        initiatorId: userId,
        partnerId: parentB.ownerId,
        parentAId: parentA.id,
        parentBId: parentB.id,
        eggId: egg.id,
        status: "completed",
      },
    });

    return { egg, reused: false };
  });
}

export async function crackEgg(
  userId: bigint,
  eggId: number,
  crackRequestId: string,
) {
  await syncEggStatuses(userId);

  const prior = await prisma.egg.findFirst({
    where: { crackRequestId, ownerId: userId },
  });
  if (prior?.openedAt) {
    const creature = await prisma.creature.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
    });
    return { egg: prior, creature, reused: true };
  }

  return prisma.$transaction(async (tx) => {
    const egg = await tx.egg.findFirst({
      where: { id: eggId, ownerId: userId, status: { in: [EggStatus.ready, EggStatus.incubating] } },
    });
    if (!egg) throw new Error("Яйцо не найдено");
    if (egg.openedAt) throw new Error("Яйцо уже вскрыто");

    const now = Date.now();
    if (egg.readyAt.getTime() > now) throw new Error("Яйцо ещё инкубируется");

    const rarityTier = egg.rarityTier ?? pickRarity(egg.id * 131 + Number(userId));
    const species = speciesForRarity(rarityTier);
    const colony = await tx.colony.findFirst({ where: { userId } });
    if (!colony) throw new Error("Колония не найдена");

    const creature = await tx.creature.create({
      data: {
        ownerId: userId,
        colonyId: colony.id,
        speciesId: species.id,
        name: `${species.name} #${egg.id}`,
        rarity: rarityTier,
        stage: Stage.egg,
        hunger: 30,
      },
    });

    const updatedEgg = await tx.egg.update({
      where: { id: egg.id },
      data: {
        status: EggStatus.opened,
        rarityTier,
        openedAt: new Date(),
        crackRequestId,
      },
    });

    if (rarityTier === Rarity.legendary || rarityTier === Rarity.rare) {
      await tx.user.update({
        where: { telegramId: userId },
        data: { tokens: { increment: rarityTier === Rarity.legendary ? 10 : 3 } },
      });
    }

    return { egg: updatedEgg, creature, species, reused: false };
  });
}

export async function spinWheel(userId: bigint, spinId: string) {
  const existing = await prisma.spinHistory.findUnique({ where: { spinId } });
  if (existing) {
    return { prize: existing.prizeJson, reused: true };
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { telegramId: userId } });
    if (!user || user.medals < WHEEL_COST) throw new Error("Недостаточно медалей");

    const prize = pickWheelPrize(
      Number(userId) + Date.now() + spinId.length,
    );

    await tx.user.update({
      where: { telegramId: userId },
      data: {
        medals: { decrement: WHEEL_COST },
        credits: { increment: "credits" in prize ? prize.credits : 0 },
        tokens: { increment: "tokens" in prize ? prize.tokens : 0 },
      },
    });

    if ("egg" in prize && prize.egg) {
      const colony = await tx.colony.findFirst({ where: { userId } });
      if (colony) {
        await tx.egg.create({
          data: {
            ownerId: userId,
            readyAt: new Date(Date.now() + INCUBATION_MS),
          },
        });
      }
    }

    if ("medals" in prize && prize.medals > 0) {
      await tx.user.update({
        where: { telegramId: userId },
        data: { medals: { increment: prize.medals } },
      });
    }

    await tx.spinHistory.create({
      data: {
        spinId,
        userId,
        medalCost: WHEEL_COST,
        prizeId: prize.id,
        prizeJson: prize,
      },
    });

    await bumpQuest(userId, "daily_spin", 1, tx);

    return { prize, reused: false };
  });
}

export async function ensureHuntEvent() {
  const active = await prisma.huntEvent.findFirst({
    where: { status: { in: [HuntEventStatus.open, HuntEventStatus.in_progress] } },
    orderBy: { id: "desc" },
  });
  if (active) return active;

  const now = new Date();
  return prisma.huntEvent.create({
    data: {
      name: "Охота на Nebula Sovereign",
      creatureName: "Nebula Sovereign",
      status: HuntEventStatus.in_progress,
      startsAt: now,
      endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

export async function getHuntState(userId: bigint) {
  const event = await ensureHuntEvent();
  const participation = await prisma.huntParticipation.findUnique({
    where: { eventId_userId: { eventId: event.id, userId } },
  });
  const top = await prisma.huntParticipation.findMany({
    where: { eventId: event.id },
    orderBy: { huntCount: "desc" },
    take: 10,
    include: { user: { select: { firstName: true, username: true } } },
  });

  return { event, participation, leaderboard: top };
}

export async function huntOnce(userId: bigint) {
  const event = await ensureHuntEvent();
  if (event.status === HuntEventStatus.closed || event.status === HuntEventStatus.claimed) {
    throw new Error("Событие завершено");
  }

  return prisma.$transaction(async (tx) => {
    const participation = await tx.huntParticipation.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      create: { eventId: event.id, userId, huntCount: 1, lastHuntAt: new Date() },
      update: { huntCount: { increment: 1 }, lastHuntAt: new Date() },
    });

    await tx.user.update({
      where: { telegramId: userId },
      data: { medals: { increment: 2 } },
    });

    await bumpQuest(userId, "daily_hunt", 1, tx);

    return { participation };
  });
}

export async function getLeaderboard() {
  const users = await prisma.user.findMany({
    orderBy: [{ totalFeeds: "desc" }, { medals: "desc" }],
    take: 20,
    select: {
      telegramId: true,
      firstName: true,
      username: true,
      totalFeeds: true,
      medals: true,
      tokens: true,
    },
  });

  return users.map((u, i) => ({
    rank: i + 1,
    userId: String(u.telegramId),
    name: u.username ? `@${u.username}` : u.firstName,
    score: u.totalFeeds * 10 + u.medals + u.tokens * 5,
    totalFeeds: u.totalFeeds,
    medals: u.medals,
  }));
}

export async function listBreedCandidates(userId: bigint) {
  return prisma.creature.findMany({
    where: {
      listed: false,
      status: "active",
      stage: { in: [Stage.adult, Stage.evolved] },
      NOT: { ownerId: userId },
    },
    take: 20,
    include: { owner: { select: { firstName: true, username: true } } },
    orderBy: { id: "desc" },
  });
}

export { speciesById };
