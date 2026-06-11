import { Bot } from "grammy";
import { config } from "../config.js";
import { registerPaymentHandlers } from "../payments/stars.js";
import { registerCommands, setupBotCommands } from "./commands.js";
import { registerInline } from "./inline.js";

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  registerCommands(bot);
  registerInline(bot);
  registerPaymentHandlers(bot);

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}

export async function initBot(bot: Bot): Promise<void> {
  await setupBotCommands(bot);
  const me = await bot.api.getMe();
  console.log(`Bot ready: @${me.username}`);
}
