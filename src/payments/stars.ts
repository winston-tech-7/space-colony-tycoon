import type { Context } from "grammy";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";
import { Rarity, Stage } from "@prisma/client";

export async function sendPremiumPlanetInvoice(
  ctx: Context,
  planetId: string,
): Promise<void> {
  if (!config.starsEnabled || !ctx.from) return;

  const titles: Record<string, string> = {
    mars: "Mars Outpost — Premium планета",
    europa: "Europa Station",
    titan: "Titan Dome",
  };

  await ctx.api.sendInvoice(
    ctx.chat!.id,
    titles[planetId] ?? "Premium планета",
    "x2 yield, редкое существо, +50 энергии",
    `premium_planet:${planetId}:${ctx.from.id}`,
    "XTR",
    [{ label: titles[planetId] ?? "Premium", amount: config.premiumPlanetStars }],
  );
}

export function registerPaymentHandlers(bot: import("grammy").Bot): void {
  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    const from = ctx.from;
    if (!from || !payment) return;

    const payload = payment.invoice_payload;
    if (payload.startsWith("premium_planet:")) {
      const [, planetId] = payload.split(":");
      const planets: Record<string, string> = {
        mars: "Mars Outpost",
        europa: "Europa Station",
        titan: "Titan Dome",
      };

      const colony = await prisma.colony.create({
        data: {
          userId: BigInt(from.id),
          planetId,
          planetName: planets[planetId] ?? "Premium Sector",
          isPremium: true,
          energy: 150,
          minerals: 50,
        },
      });

      await prisma.creature.create({
        data: {
          ownerId: BigInt(from.id),
          colonyId: colony.id,
          speciesId: "nebula",
          name: "Nebula Wisp",
          rarity: Rarity.rare,
          stage: Stage.juvenile,
          hunger: 20,
          evolutionProgress: 10,
        },
      });

      await ctx.reply(
        `✅ Premium планета *${colony.planetName}* разблокирована!`,
        { parse_mode: "Markdown" },
      );
    }
  });
}
