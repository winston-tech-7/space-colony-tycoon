import { redis } from "../db/redis.js";

export async function publishEvent(
  userId: number,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await redis.publish(
      `colony:${userId}`,
      JSON.stringify({ event, payload, at: Date.now() }),
    );
    if (event.startsWith("guild")) {
      await redis.publish(
        "guild:global",
        JSON.stringify({ event, payload, at: Date.now() }),
      );
    }
  } catch {
    // Redis optional
  }
}
