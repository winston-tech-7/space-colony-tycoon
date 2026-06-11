import "dotenv/config";
import type { GameModeId } from "./modes/registry.js";

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/** Public HTTPS URL for Mini App + webhook (Railway sets RAILWAY_PUBLIC_DOMAIN). */
export function resolveWebappUrl(): string {
  const explicit = process.env.WEBAPP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;

  return "";
}

const webappUrl = resolveWebappUrl();

export const config = {
  botToken: (process.env.BOT_TOKEN ?? "").trim(),
  botUsername: optional("BOT_USERNAME", "spacecolonybot"),
  webappUrl,
  webhookSecret: optional("WEBHOOK_SECRET", "dev-secret"),
  port: Number(optional("PORT", "3000")),
  nodeEnv: optional("NODE_ENV", "development"),
  databaseUrl: optional(
    "DATABASE_URL",
    "postgresql://colony:colony@localhost:5432/space_colony",
  ),
  redisUrl: optional("REDIS_URL", "redis://localhost:6379"),
  miniAppShortName: optional("MINI_APP_SHORT_NAME", "colony"),
  starsEnabled: optional("STARS_ENABLED", "0") === "1",
  premiumPlanetStars: Number(optional("PREMIUM_PLANET_STARS", "50")),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  usePolling: optional("USE_POLLING", "0") === "1" || !webappUrl,
} as const;

export function assertRuntimeConfig(): void {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN is required. Copy .env.example to .env");
  }
}

export function miniAppUrl(mode?: GameModeId | string, payload?: string): string {
  const shortNames: Record<string, string> = {
    colony: "colony",
    guild: "guild",
    trading: "market",
    market: "market",
    battle: "battle",
    expedition: "expedition",
    genetic: "genetic",
    admiral: "admiral",
    storyline: "storyline",
  };

  const short = shortNames[mode ?? "colony"] ?? config.miniAppShortName;
  const base = `https://t.me/${config.botUsername}/${short}`;

  if (payload) {
    return `${base}?startapp=${encodeURIComponent(payload)}`;
  }
  if (mode && mode !== "colony") {
    return `${base}?startapp=${encodeURIComponent(mode)}`;
  }
  return base;
}

export function botDeepLink(start?: string): string {
  const base = `https://t.me/${config.botUsername}`;
  return start ? `${base}?start=${encodeURIComponent(start)}` : base;
}
