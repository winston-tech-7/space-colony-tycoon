import { Redis } from "ioredis";
import { config } from "../config.js";

function isRedisEnabled(): boolean {
  const url = config.redisUrl.trim();
  if (!url) return false;
  if (
    config.nodeEnv === "production" &&
    (url.includes("localhost") || url.includes("127.0.0.1"))
  ) {
    return false;
  }
  return true;
}

function createClient(): Redis | null {
  if (!isRedisEnabled()) return null;

  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  client.on("error", () => {
    /* optional — ignore connection errors */
  });
  return client;
}

export const redis = createClient();

export async function checkRedis(): Promise<boolean> {
  if (!redis) return false;
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
  if (!redis) return;
  try {
    await redis.publish(
      `colony:${userId}`,
      JSON.stringify({ event, payload, at: Date.now() }),
    );
  } catch {
    /* Redis is optional */
  }
}
