import type { Bot } from "grammy";
import { botDeepLink, miniAppUrl } from "../config.js";
import { ensureUser, getRareCreatures } from "../modes/colony/service.js";
import { getShareableListings } from "../modes/trading/service.js";
import { Rarity } from "@prisma/client";

function rarityEmoji(rarity: Rarity): string {
  const map: Record<Rarity, string> = {
    common: "⚪",
    uncommon: "🔷",
    rare: "💎",
    legendary: "✨",
  };
  return map[rarity];
}

export function registerInline(bot: Bot): void {
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query.toLowerCase().trim();
    const userId = BigInt(ctx.from.id);

    await ensureUser(userId, ctx.from.first_name, ctx.from.username);

    if (query.includes("battle") || query.includes("challenge")) {
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "battle-challenge",
            title: "🥊 Вызов в Battle Arena",
            description: "Брось вызов другу (Phase 2 — скоро)",
            input_message_content: {
              message_text:
                "🥊 *Вызов в Battle Arena!*\n\n" +
                `${ctx.from.first_name} приглашает в PvP битву существ.`,
              parse_mode: "Markdown",
            },
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 ПРИНЯТЬ", url: miniAppUrl("battle", `challenge_${ctx.from.id}`) }],
              ],
            },
          },
        ],
        { cache_time: 10, is_personal: true },
      );
      return;
    }

    if (query.includes("expedition")) {
      const planet = query.replace("expedition", "").trim() || "mars";
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: `expedition-${planet}`,
            title: `🚀 Экспедиция на ${planet}`,
            description: "Ищу команду 2-4 игрока (Phase 3)",
            input_message_content: {
              message_text: `🚀 Набор в экспедицию на *${planet}*!`,
              parse_mode: "Markdown",
            },
            reply_markup: {
              inline_keyboard: [
                [{ text: "🚀 ВСТУПИТЬ", url: miniAppUrl("expedition", `expedition_${planet}`) }],
              ],
            },
          },
        ],
        { cache_time: 10, is_personal: true },
      );
      return;
    }

    if (query.includes("market") || query.includes("nft") || query.includes("phoenix")) {
      const listings = await getShareableListings(userId, query);
      if (listings.length === 0) {
        await ctx.answerInlineQuery(
          [
            {
              type: "article",
              id: "no-listings",
              title: "Нет листингов",
              description: "Создайте листинг в Trading Hub",
              input_message_content: {
                message_text: "🏪 Маркетплейс Space Colony Tycoon",
              },
              reply_markup: {
                inline_keyboard: [[{ text: "🏪 МАРКЕТ", url: miniAppUrl("market") }]],
              },
            },
          ],
          { cache_time: 10, is_personal: true },
        );
        return;
      }

      const results = listings.map((l, i) => ({
        type: "article" as const,
        id: `market-${l.id}-${i}`,
        title: `🏪 ${l.creature.name}`,
        description: `${l.priceCredits}💰 · ${l.priceStars}⭐`,
        input_message_content: {
          message_text:
            `🏪 *На продажу*\n\n` +
            `${l.creature.name} (${l.creature.rarity})\n` +
            `Цена: ${l.priceCredits} кредитов / ${l.priceStars}⭐`,
          parse_mode: "Markdown" as const,
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 КУПИТЬ", url: miniAppUrl("market", `nft_auction_${l.id}`) }],
          ],
        },
      }));

      await ctx.answerInlineQuery(results, { cache_time: 20, is_personal: true });
      return;
    }

    if (!query.includes("rare") && !query.includes("alien") && query !== "") {
      await ctx.answerInlineQuery([], { cache_time: 5 });
      return;
    }

    const rares = await getRareCreatures(userId);
    if (rares.length === 0) {
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "no-rares",
            title: "Пока нет редких существ",
            description: "Эволюционируй или купи premium планету",
            input_message_content: {
              message_text: "🌌 Начни колонию в Space Colony Tycoon!",
            },
            reply_markup: {
              inline_keyboard: [[{ text: "🎮 ИГРАТЬ", url: miniAppUrl() }]],
            },
          },
        ],
        { cache_time: 10, is_personal: true },
      );
      return;
    }

    const results = rares.map(({ creature, species }, index) => ({
      type: "article" as const,
      id: `rare-${creature.id}-${index}`,
      title: `${species.emoji} ${creature.name}`,
      description: `${rarityEmoji(creature.rarity)} ${creature.rarity}`,
      input_message_content: {
        message_text:
          `✨ *Редкое существо*\n\n${species.emoji} *${creature.name}*\n` +
          `Стадия: ${creature.stage} · ${creature.evolutionProgress}%`,
        parse_mode: "Markdown" as const,
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎮 ИГРАТЬ", url: miniAppUrl() }],
          [{ text: "🤖 Бот", url: botDeepLink() }],
        ],
      },
    }));

    await ctx.answerInlineQuery(results, { cache_time: 30, is_personal: true });
  });
}
