import { prisma } from "../../db/prisma.js";

function todayDate() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const QUEST_DEFS = [
  { id: "daily_feed", title: "Покормить существ", target: 3, rewardMedals: 15 },
  { id: "daily_spin", title: "Крутить рулетку", target: 1, rewardMedals: 20 },
  { id: "daily_hunt", title: "Охота на легенду", target: 5, rewardMedals: 30 },
] as const;

const DEF_MAP = Object.fromEntries(QUEST_DEFS.map((q) => [q.id, q]));

export async function getQuests(userId: bigint) {
  const day = todayDate();
  const progress = await prisma.questProgress.findMany({
    where: { userId, day },
  });
  const byId = new Map(progress.map((p) => [p.questId, p]));

  return QUEST_DEFS.map((q) => {
    const p = byId.get(q.id);
    return {
      ...q,
      progress: p?.progress ?? 0,
      completed: !!p?.completedAt,
    };
  });
}

type PrismaTx = Pick<typeof prisma, "questProgress" | "user">;

export async function bumpQuest(
  userId: bigint,
  questId: string,
  amount: number,
  tx: PrismaTx = prisma,
) {
  const def = DEF_MAP[questId];
  if (!def) return;

  const day = todayDate();
  const row = await tx.questProgress.upsert({
    where: { userId_questId_day: { userId, questId, day } },
    create: { userId, questId, day, progress: amount },
    update: { progress: { increment: amount } },
  });

  if (!row.completedAt && row.progress >= def.target) {
    await tx.questProgress.update({
      where: { userId_questId_day: { userId, questId, day } },
      data: { completedAt: new Date() },
    });
    await tx.user.update({
      where: { telegramId: userId },
      data: { medals: { increment: def.rewardMedals } },
    });
  }
}
