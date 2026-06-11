import { createHash } from "node:crypto";
import { PremiumTier } from "@prisma/client";
import { config } from "../../config.js";
import { prisma } from "../../db/prisma.js";
import { computePowerRating, getProfile } from "../colony/service.js";
import { getBattleLeaderboard } from "../battle/service.js";
import { getActiveListings } from "../trading/service.js";

const FREE_DAILY_LIMIT = 3;

interface AdmiralContext {
  player: {
    name: string;
    credits: number;
    premiumTier: PremiumTier;
    creatureCount: number;
    colonyLevel: number;
    energy: number;
    minerals: number;
    rareCount: number;
    power: number;
  };
  guild: { name: string; tag: string; power: number } | null;
  market: { listings: number; cheapestRare: number | null };
  battles: { topWins: number };
}

async function buildContext(telegramId: bigint): Promise<AdmiralContext> {
  const profile = await getProfile(telegramId);
  if (!profile) throw new Error("Profile not found");

  const colony = profile.colonies[0];
  const guild = profile.guildMemberships[0]?.guild;
  const listings = await getActiveListings(50);
  const leaderboard = await getBattleLeaderboard(1);

  const rarePrices = listings
    .filter((l) => l.creature.rarity === "rare" || l.creature.rarity === "legendary")
    .map((l) => l.priceCredits);

  return {
    player: {
      name: profile.firstName,
      credits: profile.credits,
      premiumTier: profile.premiumTier,
      creatureCount: profile.creatures.length,
      colonyLevel: colony?.level ?? 1,
      energy: colony?.energy ?? 0,
      minerals: colony?.minerals ?? 0,
      rareCount: profile.creatures.filter(
        (c) => c.rarity === "rare" || c.rarity === "legendary",
      ).length,
      power: computePowerRating(profile),
    },
    guild: guild
      ? { name: guild.name, tag: guild.tag, power: guild.powerRating }
      : null,
    market: {
      listings: listings.length,
      cheapestRare: rarePrices.length ? Math.min(...rarePrices) : null,
    },
    battles: { topWins: leaderboard[0]?.wins ?? 0 },
  };
}

function contextHash(ctx: AdmiralContext): string {
  return createHash("sha256").update(JSON.stringify(ctx)).digest("hex").slice(0, 16);
}

function ruleBasedAdvice(ctx: AdmiralContext): string {
  const tips: string[] = [];

  tips.push(
    `🪐 Командир ${ctx.player.name}, анализ колонии завершён.`,
  );

  if (ctx.player.energy < 30) {
    tips.push("⚡ Энергия низкая — собери idle-ресурсы в Colony Builder.");
  }
  if (ctx.player.creatureCount < 3) {
    tips.push("👽 Разведи больше существ — 3+ вида дают бонус к power rating.");
  }
  if (ctx.player.rareCount === 0) {
    tips.push("💎 Нет редких существ — эволюционируй Zephyr или купи premium планету.");
  } else {
    tips.push(
      `💎 ${ctx.player.rareCount} редких существ — оптимально для Guild War (power ${ctx.player.power}).`,
    );
  }
  if (!ctx.guild) {
    tips.push("⚔️ Вступи в гильдию — +100 кредитов за сезонные войны.");
  } else {
    tips.push(
      `⚔️ Гильдия [${ctx.guild.tag}] power ${ctx.guild.power} — запусти Guild War на выходных.`,
    );
  }
  if (ctx.market.cheapestRare && ctx.player.credits >= ctx.market.cheapestRare) {
    tips.push(
      `🏪 На маркете редкое существо от ${ctx.market.cheapestRare}💰 — выгодная покупка.`,
    );
  }
  tips.push("🥊 Battle Arena: выбери существо с max power для PvP.");

  return tips.join("\n\n");
}

async function gptAdvice(ctx: AdmiralContext): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: config.openaiApiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content:
          "Ты AI Admiral в космической игре Space Colony Tycoon. " +
          "Дай 3-5 коротких стратегических советов на русском. Используй эмодзи. " +
          "Фокус: колония, гильдия, маркет, битвы. Без общих фраз.",
      },
      {
        role: "user",
        content: JSON.stringify(ctx, null, 2),
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? ruleBasedAdvice(ctx);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function dailyUsage(userId: bigint): Promise<number> {
  return prisma.aiInteraction.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  });
}

export async function getAdmiralAdvice(telegramId: bigint) {
  const profile = await getProfile(telegramId);
  if (!profile) throw new Error("Profile not found");

  const unlimited =
    profile.premiumTier === PremiumTier.admiral ||
    profile.premiumTier === PremiumTier.emperor ||
    profile.aiAdvisorEnabled;

  const used = await dailyUsage(telegramId);
  if (!unlimited && used >= FREE_DAILY_LIMIT) {
    return {
      advice:
        "🔒 Лимит советов исчерпан (3/день).\n\n" +
        "Tier Admiral — безлимитные советы AI Admiral.",
      source: "limit" as const,
      remaining: 0,
      unlimited: false,
    };
  }

  const ctx = await buildContext(telegramId);
  const hash = contextHash(ctx);

  const cached = await prisma.aiInteraction.findFirst({
    where: { userId: telegramId, contextHash: hash },
    orderBy: { createdAt: "desc" },
  });

  if (cached && Date.now() - cached.createdAt.getTime() < 30 * 60_000) {
    return {
      advice: cached.adviceGiven,
      source: config.openaiApiKey ? "gpt" : "rules",
      remaining: unlimited ? null : FREE_DAILY_LIMIT - used,
      unlimited,
      cached: true,
    };
  }

  let advice: string;
  let source: "gpt" | "rules" = "rules";

  if (config.openaiApiKey) {
    try {
      advice = await gptAdvice(ctx);
      source = "gpt";
    } catch {
      advice = ruleBasedAdvice(ctx);
    }
  } else {
    advice = ruleBasedAdvice(ctx);
  }

  await prisma.aiInteraction.create({
    data: { userId: telegramId, contextHash: hash, adviceGiven: advice },
  });

  const newUsed = await dailyUsage(telegramId);

  return {
    advice,
    source,
    remaining: unlimited ? null : Math.max(0, FREE_DAILY_LIMIT - newUsed),
    unlimited,
    context: ctx,
  };
}

export async function getAdmiralHistory(telegramId: bigint, limit = 5) {
  return prisma.aiInteraction.findMany({
    where: { userId: telegramId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function enableAiAdvisor(telegramId: bigint) {
  return prisma.user.update({
    where: { telegramId },
    data: { aiAdvisorEnabled: true },
  });
}
