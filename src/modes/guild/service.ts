import { GuildRole, WarStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { computePowerRating, getProfile } from "../colony/service.js";
import { publishEvent } from "../../realtime/events.js";

const MAX_GUILD_SIZE = 50;
const MIN_GUILD_SIZE = 1;

export function currentSeason(): number {
  const start = new Date("2026-01-01T00:00:00Z");
  const weeks = Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return weeks + 1;
}

export async function createGuild(
  leaderId: bigint,
  name: string,
  tag: string,
) {
  const profile = await getProfile(leaderId);
  if (!profile) throw new Error("User not found");
  if (profile.guildMemberships.length > 0) {
    throw new Error("Already in a guild");
  }

  const power = computePowerRating(profile);

  const guild = await prisma.guild.create({
    data: {
      name,
      tag: tag.toUpperCase(),
      leaderId,
      memberCount: 1,
      powerRating: power,
      members: {
        create: { userId: leaderId, role: GuildRole.leader },
      },
    },
    include: { members: { include: { user: true } } },
  });

  await publishEvent(Number(leaderId), "guild_created", { guildId: guild.id });
  return guild;
}

export async function joinGuild(userId: bigint, guildTag: string) {
  const guild = await prisma.guild.findFirst({
    where: { tag: guildTag.toUpperCase() },
    include: { members: true },
  });
  if (!guild) throw new Error("Guild not found");
  if (guild.memberCount >= MAX_GUILD_SIZE) throw new Error("Guild is full");

  const existing = await prisma.guildMember.findFirst({ where: { userId } });
  if (existing) throw new Error("Already in a guild");

  const profile = await getProfile(userId);
  if (!profile) throw new Error("User not found");

  await prisma.guildMember.create({
    data: { guildId: guild.id, userId, role: GuildRole.member },
  });

  const power = computePowerRating(profile);
  await prisma.guild.update({
    where: { id: guild.id },
    data: {
      memberCount: { increment: 1 },
      powerRating: { increment: power },
    },
  });

  await publishEvent(Number(userId), "guild_joined", { guildId: guild.id });
  return prisma.guild.findUnique({
    where: { id: guild.id },
    include: { members: { include: { user: true } } },
  });
}

export async function getGuildForUser(userId: bigint) {
  const membership = await prisma.guildMember.findFirst({
    where: { userId },
    include: {
      guild: {
        include: {
          members: { include: { user: true } },
          warsAs1: { where: { status: { in: [WarStatus.pending, WarStatus.active] } }, take: 1 },
          warsAs2: { where: { status: { in: [WarStatus.pending, WarStatus.active] } }, take: 1 },
        },
      },
    },
  });
  return membership;
}

export async function refreshGuildPower(guildId: number) {
  const members = await prisma.guildMember.findMany({ where: { guildId } });
  let total = 0;
  for (const m of members) {
    const profile = await getProfile(m.userId);
    if (profile) total += computePowerRating(profile);
  }
  await prisma.guild.update({
    where: { id: guildId },
    data: { powerRating: total, memberCount: members.length },
  });
  return total;
}

export async function startGuildWar(guildId: number) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) throw new Error("Guild not found");
  if (guild.memberCount < MIN_GUILD_SIZE) {
    throw new Error("Need more members for war");
  }

  const season = currentSeason();
  const activeWar = await prisma.guildWar.findFirst({
    where: {
      season,
      status: { in: [WarStatus.pending, WarStatus.active] },
      OR: [{ guild1Id: guildId }, { guild2Id: guildId }],
    },
  });
  if (activeWar) return activeWar;

  await refreshGuildPower(guildId);

  const allGuilds = await prisma.guild.findMany({
    where: { id: { not: guildId }, memberCount: { gte: 1 } },
    orderBy: { powerRating: "asc" },
  });

  const busyGuildIds = new Set(
    (
      await prisma.guildWar.findMany({
        where: { season, status: { in: [WarStatus.pending, WarStatus.active] } },
        select: { guild1Id: true, guild2Id: true },
      })
    ).flatMap((w) => [w.guild1Id, w.guild2Id]),
  );

  const opponent = allGuilds.find((g) => !busyGuildIds.has(g.id));

  if (!opponent) throw new Error("No opponent available this season");

  const now = new Date();
  const endsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const war = await prisma.guildWar.create({
    data: {
      season,
      guild1Id: guildId,
      guild2Id: opponent.id,
      status: WarStatus.active,
      guild1Score: guild.powerRating,
      guild2Score: opponent.powerRating,
      startsAt: now,
      endsAt,
    },
    include: { guild1: true, guild2: true },
  });

  await publishEvent(0, "guild_war_started", {
    warId: war.id,
    guild1: war.guild1.name,
    guild2: war.guild2.name,
  });

  return war;
}

export async function resolveExpiredWars() {
  const wars = await prisma.guildWar.findMany({
    where: {
      status: WarStatus.active,
      endsAt: { lte: new Date() },
    },
    include: { guild1: true, guild2: true },
  });

  for (const war of wars) {
    const winnerId =
      war.guild1Score >= war.guild2Score ? war.guild1Id : war.guild2Id;
    await prisma.guildWar.update({
      where: { id: war.id },
      data: {
        status: WarStatus.completed,
        winnerId,
        rewardsJson: { credits: 100, minerals: 50 },
      },
    });
  }

  return wars.length;
}

export async function listTopGuilds(limit = 10) {
  return prisma.guild.findMany({
    orderBy: { powerRating: "desc" },
    take: limit,
    include: { members: { take: 5, include: { user: true } } },
  });
}
