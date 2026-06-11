import { spawn } from "node:child_process";
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

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrateDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      console.log(`prisma db push (${attempt}/15)...`);
      await runCommand("npx", ["prisma", "db", "push", "--skip-generate"]);
      return;
    } catch {
      if (attempt === 15) throw new Error("prisma db push failed");
      console.warn("db push failed, retrying in 3s...");
      await sleep(3000);
    }
  }
}

async function waitForDatabase(): Promise<boolean> {
  for (let attempt = 1; attempt <= 20; attempt++) {
    if (await checkDatabase()) return true;
    console.warn(`PostgreSQL not ready (${attempt}/20), retrying...`);
    await sleep(3000);
  }
  return false;
}

async function bootstrap(
  app: ReturnType<typeof createApp>,
  io: ReturnType<typeof createSocketServer>,
): Promise<void> {
  await migrateDatabase();
  const dbOk = await waitForDatabase();
  const redisOk = await checkRedis();

  if (!dbOk) {
    console.error("PostgreSQL unavailable after retries");
    process.exit(1);
  }

  console.log(`PostgreSQL: ok | Redis: ${redisOk ? "ok" : "optional/offline"}`);

  const bot = createBot();
  const webhookPath = `/webhook/${config.webhookSecret}`;
  app.post(webhookPath, webhookCallback(bot, "express"));

  try {
    await initBot(bot);
  } catch (err) {
    console.warn("Bot init deferred:", err);
  }

  setInterval(() => {
    resolveExpiredWars().catch(console.error);
  }, 60 * 60 * 1000);

  if (config.usePolling) {
    await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    console.log("Using long polling (local dev only).");
    void bot.start({
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
  } else if (config.webappUrl) {
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
  } else {
    console.warn(
      "No public URL yet — generate Railway domain, then redeploy for webhook",
    );
  }

  console.log(`Socket.io ready (${io.engine.clientsCount} clients)`);
}

async function main(): Promise<void> {
  assertRuntimeConfig();

  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  setIo(io);

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(config.port, "0.0.0.0", () => {
      console.log(`HTTP + WebSocket on :${config.port}`);
      if (config.webappUrl) {
        console.log(`Public URL: ${config.webappUrl}`);
      }
      resolve();
    });
    httpServer.on("error", reject);
  });

  void bootstrap(app, io).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
