import { prisma } from "./prisma.js";

export async function claimIdempotencyKey(
  userId: bigint,
  scope: string,
  ttlSeconds = 60,
): Promise<boolean> {
  const epoch = Math.floor(Date.now() / 1000 / ttlSeconds);
  const key = `${scope}:${userId}:${epoch}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    await prisma.idempotencyKey.create({
      data: { key, userId, expiresAt },
    });
    return true;
  } catch {
    return false;
  }
}
