import { Redis } from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

export async function checkRedis(): Promise<boolean> {
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function publishColonyEvent(
  userId: number,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await redis.publish(
      `colony:${userId}`,
      JSON.stringify({ event, payload, at: Date.now() }),
    );
  } catch {
    // Redis is optional for MVP starter
  }
}
