import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { createApp } from "./api/app.js";
import { assertRuntimeConfig, config } from "./config.js";
import { createBot, initBot } from "./bot/index.js";
import { checkDatabase } from "./db/prisma.js";
import { checkRedis } from "./db/redis.js";
import { resolveExpiredWars } from "./modes/guild/service.js";
import { setIo } from "./realtime/io.js";
import { createSocketServer } from "./realtime/socket.js";

async function main(): Promise<void> {
  assertRuntimeConfig();

  const dbOk = await checkDatabase();
  const redisOk = await checkRedis();

  if (!dbOk) {
    console.error(
      "PostgreSQL unavailable. Run: docker compose up -d && npx prisma db push",
    );
    process.exit(1);
  }

  console.log(`PostgreSQL: ok | Redis: ${redisOk ? "ok" : "optional/offline"}`);

  const bot = createBot();
  await initBot(bot);

  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  setIo(io);

  const webhookPath = `/webhook/${config.webhookSecret}`;
  app.post(webhookPath, webhookCallback(bot, "express"));

  httpServer.listen(config.port, "0.0.0.0", () => {
    console.log(`HTTP + WebSocket on :${config.port}`);
    if (config.webappUrl) {
      console.log(`Public URL: ${config.webappUrl}`);
    }
  });

  setInterval(() => {
    resolveExpiredWars().catch(console.error);
  }, 60 * 60 * 1000);

  if (config.usePolling) {
    await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    console.log("Using long polling (dev). Set WEBAPP_URL for webhook.");
    bot.start({
      allowed_updates: [
        "message",
        "inline_query",
        "pre_checkout_query",
        "callback_query",
      ],
    });
    return;
  }

  const webhookUrl = `${config.webappUrl.replace(/\/$/, "")}${webhookPath}`;
  const isLocal =
    config.webappUrl.includes("localhost") ||
    config.webappUrl.includes("127.0.0.1");

  if (isLocal) {
    console.log(`Local dev: http://localhost:${config.port} (webhook skipped)`);
  } else {
    try {
      await bot.api.setWebhook(webhookUrl, {
        allowed_updates: [
          "message",
          "inline_query",
          "pre_checkout_query",
          "callback_query",
        ],
      });
      console.log(`Webhook: ${webhookUrl}`);
    } catch (err) {
      console.warn("Webhook setup failed:", err);
    }
  }
  console.log(`Socket.io ready (${io.engine.clientsCount} clients)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
