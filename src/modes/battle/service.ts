import { Prisma, Rarity, Stage, type Creature } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { emitToBattle, emitToUser } from "../../realtime/io.js";

const RARITY_POWER: Record<Rarity, number> = {
  common: 12,
  uncommon: 22,
  rare: 45,
  legendary: 90,
};

const STAGE_POWER: Record<Stage, number> = {
  egg: 0,
  juvenile: 8,
  adult: 18,
  evolved: 35,
};

const WIN_REWARD = 25;

export function creaturePower(creature: Creature): number {
  return (
    RARITY_POWER[creature.rarity] +
    STAGE_POWER[creature.stage] +
    Math.floor(creature.evolutionProgress * 0.3)
  );
}

type BattleLog = Array<{ turn: number; text: string }>;

function parseLog(json: Prisma.JsonValue): BattleLog {
  if (Array.isArray(json)) return json as BattleLog;
  return [];
}

type BattleWithPlayers = Awaited<ReturnType<typeof loadBattle>>;

async function loadBattle(battleId: number) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      player1: { select: { telegramId: true, firstName: true } },
      player2: { select: { telegramId: true, firstName: true } },
    },
  });
}

async function getCreatureMap(battle: { creature1Id: number; creature2Id: number | null }) {
  const ids = [battle.creature1Id, battle.creature2Id].filter(Boolean) as number[];
  const creatures = await prisma.creature.findMany({ where: { id: { in: ids } } });
  const map = new Map(creatures.map((c) => [c.id, c]));
  return {
    c1: map.get(battle.creature1Id),
    c2: battle.creature2Id ? map.get(battle.creature2Id) : undefined,
  };
}

export async function createChallenge(
  challengerId: bigint,
  defenderId: bigint,
  creatureId: number,
) {
  if (challengerId === defenderId) {
    throw new Error("Cannot challenge yourself");
  }

  const creature = await prisma.creature.findFirst({
    where: { id: creatureId, ownerId: challengerId, listed: false },
  });
  if (!creature) throw new Error("Creature not found");

  await prisma.user.upsert({
    where: { telegramId: defenderId },
    create: { telegramId: defenderId, firstName: "Commander" },
    update: {},
  });

  const existing = await prisma.battle.findFirst({
    where: {
      status: "pending",
      player1Id: challengerId,
      player2Id: defenderId,
    },
  });
  if (existing) return existing;

  const battle = await prisma.battle.create({
    data: {
      player1Id: challengerId,
      player2Id: defenderId,
      creature1Id: creatureId,
      status: "pending",
      logJson: [
        {
          turn: 0,
          text: `Вызов отправлен существом ${creature.name}`,
        },
      ],
    },
    include: {
      player1: { select: { firstName: true } },
      player2: { select: { firstName: true } },
    },
  });

  emitToUser(Number(defenderId), "battle:challenge", { battleId: battle.id });
  return battle;
}

export async function acceptChallenge(
  defenderId: bigint,
  battleId: number,
  creatureId: number,
) {
  const battle = await loadBattle(battleId);
  if (!battle) throw new Error("Battle not found");
  if (battle.player2Id !== defenderId) throw new Error("Not your challenge");
  if (battle.status !== "pending") throw new Error("Battle already started");

  const creature = await prisma.creature.findFirst({
    where: { id: creatureId, ownerId: defenderId, listed: false },
  });
  if (!creature) throw new Error("Creature not found");

  const c1 = await prisma.creature.findUnique({ where: { id: battle.creature1Id } });
  if (!c1) throw new Error("Challenger creature missing");
  const p1Power = creaturePower(c1);
  const p2Power = creaturePower(creature);

  const updated = await prisma.battle.update({
    where: { id: battleId },
    data: {
      creature2Id: creatureId,
      status: "active",
      currentTurn: battle.player1Id,
      p1Hp: 80 + Math.floor(p1Power * 0.5),
      p2Hp: 80 + Math.floor(p2Power * 0.5),
      logJson: [
        ...parseLog(battle.logJson),
        { turn: 0, text: `${creature.name} принял вызов! Бой начался.` },
      ],
    },
    include: {
      player1: { select: { firstName: true, telegramId: true } },
      player2: { select: { firstName: true, telegramId: true } },
    },
  });

  const payload = await formatBattle(updated);
  emitToBattle(battleId, "battle:update", payload);
  return payload;
}

export async function battleTurn(
  playerId: bigint,
  battleId: number,
  action: "attack" | "defend",
) {
  const battle = await loadBattle(battleId);
  if (!battle) throw new Error("Battle not found");
  if (battle.status !== "active") throw new Error("Battle not active");
  if (battle.currentTurn !== playerId) throw new Error("Not your turn");
  if (!battle.creature2Id) throw new Error("Waiting for opponent");

  const { c1, c2 } = await getCreatureMap(battle);
  if (!c2) throw new Error("Missing defender creature");

  const isP1 = playerId === battle.player1Id;
  const attacker = isP1 ? c1 : c2;
  const defender = isP1 ? c2 : c1;
  if (!attacker || !defender) throw new Error("Battle creatures missing");
  const atkPower = creaturePower(attacker);

  const defendMult = action === "defend" ? 0.45 : 1;
  const variance = Math.floor(Math.random() * 8);
  const damage = Math.max(5, Math.floor(atkPower * 0.35 * defendMult) + variance);

  let p1Hp = battle.p1Hp;
  let p2Hp = battle.p2Hp;
  if (isP1) {
    p2Hp = Math.max(0, p2Hp - damage);
  } else {
    p1Hp = Math.max(0, p1Hp - damage);
  }

  const log = parseLog(battle.logJson);
  const actionLabel = action === "defend" ? "атакует (противник в защите)" : "атакует";
  log.push({
    turn: battle.turn + 1,
    text: `${attacker.name} ${actionLabel} → ${damage} урона по ${defender.name}`,
  });

  let winnerId: bigint | null = null;
  let status = "active";
  let nextTurn: bigint | null = isP1 ? battle.player2Id : battle.player1Id;

  if (p1Hp <= 0 || p2Hp <= 0) {
    winnerId = p1Hp <= 0 ? battle.player2Id : battle.player1Id;
    status = "completed";
    nextTurn = null;
    log.push({
      turn: battle.turn + 1,
      text: `🏆 Победитель: ${winnerId === battle.player1Id ? battle.player1.firstName : battle.player2.firstName}`,
    });

    await prisma.user.update({
      where: { telegramId: winnerId },
      data: { credits: { increment: WIN_REWARD } },
    });
  }

  const updated = await prisma.battle.update({
    where: { id: battleId },
    data: {
      p1Hp,
      p2Hp,
      turn: battle.turn + 1,
      currentTurn: nextTurn,
      winnerId,
      status,
      logJson: log,
    },
    include: {
      player1: { select: { firstName: true, telegramId: true } },
      player2: { select: { firstName: true, telegramId: true } },
    },
  });

  const payload = await formatBattle(updated);
  emitToBattle(battleId, "battle:update", payload);
  emitToUser(Number(battle.player1Id), "battle:update", payload);
  emitToUser(Number(battle.player2Id), "battle:update", payload);

  return payload;
}

export async function formatBattle(battle: NonNullable<BattleWithPlayers>) {
  const { c1, c2 } = await getCreatureMap(battle);
  return {
    id: battle.id,
    status: battle.status,
    turn: battle.turn,
    p1Hp: battle.p1Hp,
    p2Hp: battle.p2Hp,
    currentTurn: battle.currentTurn?.toString() ?? null,
    winnerId: battle.winnerId?.toString() ?? null,
    log: parseLog(battle.logJson),
    player1: {
      id: battle.player1.telegramId.toString(),
      name: battle.player1.firstName,
    },
    player2: {
      id: battle.player2.telegramId.toString(),
      name: battle.player2.firstName,
    },
    creature1: c1
      ? { id: c1.id, name: c1.name, rarity: c1.rarity, power: creaturePower(c1) }
      : null,
    creature2: c2
      ? { id: c2.id, name: c2.name, rarity: c2.rarity, power: creaturePower(c2) }
      : null,
  };
}

export async function getBattle(battleId: number) {
  const battle = await loadBattle(battleId);
  if (!battle) throw new Error("Battle not found");
  return formatBattle(battle);
}

export async function getUserBattles(userId: bigint) {
  const battles = await prisma.battle.findMany({
    where: { OR: [{ player1Id: userId }, { player2Id: userId }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      player1: { select: { firstName: true, telegramId: true } },
      player2: { select: { firstName: true, telegramId: true } },
    },
  });

  return Promise.all(battles.map(formatBattle));
}

export async function getBattleLeaderboard(limit = 10) {
  const wins = await prisma.battle.groupBy({
    by: ["winnerId"],
    where: { status: "completed", winnerId: { not: null } },
    _count: { winnerId: true },
    orderBy: { _count: { winnerId: "desc" } },
    take: limit,
  });

  const users = await prisma.user.findMany({
    where: { telegramId: { in: wins.map((w) => w.winnerId!).filter(Boolean) } },
    select: { telegramId: true, firstName: true, username: true },
  });

  const userMap = new Map(users.map((u) => [u.telegramId.toString(), u]));

  return wins.map((w) => ({
    userId: w.winnerId!.toString(),
    wins: w._count.winnerId,
    name: userMap.get(w.winnerId!.toString())?.firstName ?? "Commander",
  }));
}

export async function getPendingChallenges(userId: bigint) {
  const battles = await prisma.battle.findMany({
    where: { player2Id: userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    include: {
      player1: { select: { firstName: true, telegramId: true } },
      player2: { select: { firstName: true, telegramId: true } },
    },
  });
  return Promise.all(battles.map(formatBattle));
}
