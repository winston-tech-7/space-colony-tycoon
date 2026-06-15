import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { config } from "../config.js";
import {
  ensureUser,
  feedCreatures,
  formatColonyStatus,
} from "../modes/colony/service.js";
import { getGuildForUser, listTopGuilds } from "../modes/guild/service.js";
import { getAdmiralAdvice } from "../modes/admiral/service.js";
import { getBattleLeaderboard, getPendingChallenges } from "../modes/battle/service.js";
import { getActiveListings } from "../modes/trading/service.js";
import { Rarity } from "@prisma/client";
import { sendPremiumPlanetInvoice } from "../payments/stars.js";
import { mainMenuKeyboard, modePickerKeyboard, openModeKeyboard } from "./keyboards.js";

const WELCOME =
  "🪐 *Space Colony Tycoon*\n\n" +
  "Космическая колония, где существа работают на вас.\n\n" +
  "Кормите существ → скрещивайте → вскрывайте яйца → торгуйте на рынке → охотьтесь на легендарных созданий.\n\n" +
  "Чем раньше начнёте — тем выше шанс попасть в топ колонизаторов.";

export function startInlineKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (config.webappUrl) {
    kb.webApp("🚀 Играть", config.webappUrl).row();
  }
  kb.url("📢 Подписаться на канал", "https://t.me/spacecolonyT_bot").row();
  kb.url("📜 Условия", "https://space-colony-tycoon-production.up.railway.app/terms");
  return kb;
}

const HELP =
  "📖 *Команды 2.0*\n\n" +
  "/start — онбординг и стартовая колония\n" +
  "/colony — статус колонии\n" +
  "/feed — кормление существ\n" +
  "/guild — ваша гильдия и войны\n" +
  "/market — маркетплейс\n" +
  "/battle — Battle Arena\n" +
  "/admiral — AI советник\n" +
  "/modes — все 8 режимов\n" +
  "/help — справка\n\n" +
  "*Inline:*\n" +
  "`@bot rare` — редкое существо\n" +
  "`@bot battle` — вызов в арену\n" +
  "`@bot expedition mars` — поиск команды\n" +
  "`@bot market phoenix` — NFT на продажу";

function rarityEmoji(rarity: Rarity): string {
  const map: Record<Rarity, string> = {
    common: "⚪",
    uncommon: "🔷",
    rare: "💎",
    legendary: "✨",
  };
  return map[rarity];
}

export async function setupBotCommands(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([
    { command: "start", description: "Запустить колонию" },
    { command: "colony", description: "Статус колонии" },
    { command: "feed", description: "Кормление" },
    { command: "guild", description: "Гильдия и войны" },
    { command: "market", description: "Маркетплейс" },
    { command: "battle", description: "Battle Arena" },
    { command: "admiral", description: "AI Admiral" },
    { command: "modes", description: "8 игровых режимов" },
    { command: "help", description: "Справка" },
  ]);
}

export function registerCommands(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const startParam = ctx.match?.trim();
    await ensureUser(BigInt(from.id), from.first_name, from.username);

    let extra = "";
    if (startParam?.startsWith("ref_")) extra = "\n\n🎁 Реферальная ссылка принята!";
    if (startParam?.startsWith("join_")) {
      extra = `\n\n⚔️ Приглашение в гильдию: *${startParam.replace("join_", "")}*`;
    }

    await ctx.reply(WELCOME + extra, {
      parse_mode: "Markdown",
      reply_markup: startInlineKeyboard(),
    });

    const profile = await ensureUser(BigInt(from.id), from.first_name, from.username);
    const creature = profile?.creatures[0];
    if (creature) {
      await ctx.reply(
        `👽 *${creature.name}* готов к эволюции!\n` +
          `Редкость: ${rarityEmoji(creature.rarity)} ${creature.rarity}`,
        {
          parse_mode: "Markdown",
          reply_markup: openModeKeyboard("colony", startParam),
        },
      );
    }
  });

  bot.command("colony", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const profile = await ensureUser(BigInt(from.id), from.first_name, from.username);
    if (!profile) return;
    await ctx.reply(formatColonyStatus(profile), {
      parse_mode: "Markdown",
      reply_markup: openModeKeyboard("colony"),
    });
  });

  bot.command("feed", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const result = await feedCreatures(BigInt(from.id));
    const note =
      result.evolved > 0 ? `\n✨ Эволюционировало: *${result.evolved}*` : "";
    await ctx.reply(`🍽 Покормлено: *${result.fed}*${note}`, {
      parse_mode: "Markdown",
      reply_markup: openModeKeyboard("colony"),
    });
  });

  bot.command("guild", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const membership = await getGuildForUser(BigInt(from.id));
    if (!membership) {
      const top = await listTopGuilds(5);
      const list = top.map((g) => `• *[${g.tag}]* ${g.name} · ⚡${g.powerRating}`).join("\n");
      await ctx.reply(
        "⚔️ *Guild Wars*\n\nВы не в гильдии. Создайте в Mini App или вступите:\n\n" +
          (list || "_Пока нет гильдий_"),
        { parse_mode: "Markdown", reply_markup: openModeKeyboard("guild") },
      );
      return;
    }

    const g = membership.guild;
    const war = g.warsAs1[0] ?? g.warsAs2[0];
    const warText = war
      ? `\n🔥 Активная война: ${war.guild1Score} vs ${war.guild2Score}`
      : "\n🕊 Нет активной войны — начните в Mini App";

    await ctx.reply(
      `⚔️ *[${g.tag}]* ${g.name}\n` +
        `👥 ${g.memberCount}/50 · ⚡ ${g.powerRating}${warText}`,
      { parse_mode: "Markdown", reply_markup: openModeKeyboard("guild") },
    );
  });

  bot.command("market", async (ctx) => {
    const listings = await getActiveListings(5);
    const lines = listings
      .map((l) => `• ${l.creature.name} — ${l.priceCredits}💰 / ${l.priceStars}⭐`)
      .join("\n");

    await ctx.reply(
      `🏪 *Trading Hub*\n\n${lines || "_Пока нет листингов_"}`,
      { parse_mode: "Markdown", reply_markup: openModeKeyboard("market") },
    );

    if (config.starsEnabled && ctx.from) {
      await sendPremiumPlanetInvoice(ctx, "mars");
    }
  });

  bot.command("battle", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const pending = await getPendingChallenges(BigInt(from.id));
    const top = await getBattleLeaderboard(3);
    const pendingText =
      pending.length > 0
        ? `\n\n📨 Входящих вызовов: *${pending.length}*`
        : "";
    const topText = top
      .map((t, i) => `${i + 1}. ${t.name} — ${t.wins} побед`)
      .join("\n");

    await ctx.reply(
      `🥊 *Battle Arena*\n\nТоп:\n${topText || "_Пока пусто_"}${pendingText}`,
      { parse_mode: "Markdown", reply_markup: openModeKeyboard("battle") },
    );
  });

  bot.command("admiral", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    await ensureUser(BigInt(from.id), from.first_name, from.username);
    const result = await getAdmiralAdvice(BigInt(from.id));

    await ctx.reply(result.advice, {
      reply_markup: openModeKeyboard("admiral"),
    });
  });

  bot.command("modes", async (ctx) => {
    await ctx.reply("🎮 *8 режимов Space Colony 2.0*", {
      parse_mode: "Markdown",
      reply_markup: modePickerKeyboard(),
    });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.hears("📊 Статус", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const profile = await ensureUser(BigInt(from.id), from.first_name, from.username);
    if (!profile) return;
    await ctx.reply(formatColonyStatus(profile), {
      parse_mode: "Markdown",
      reply_markup: openModeKeyboard("colony"),
    });
  });

  bot.hears("🍽 Кормление", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const result = await feedCreatures(BigInt(from.id));
    await ctx.reply(`🍽 Покормлено: ${result.fed}`, {
      reply_markup: openModeKeyboard("colony"),
    });
  });

  bot.hears(["⚔️ Гильдия", "🏪 Маркет", "🚀 КОЛОНИЯ"], async (ctx) => {
    const text = ctx.message?.text ?? "";
    const mode = text.includes("Гильдия")
      ? "guild"
      : text.includes("Маркет")
        ? "market"
        : "colony";
    await ctx.reply(`Открой режим в Mini App:`, {
      reply_markup: openModeKeyboard(mode as "colony" | "guild" | "market"),
    });
  });

  bot.hears("❓ Помощь", async (ctx) => {
    await ctx.reply(HELP, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });
}
