import crypto from "node:crypto";
import { isValid3rd, parse } from "@telegram-apps/init-data-node";

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface ValidatedInitData {
  user: TelegramWebAppUser;
  authDate: number;
  queryId?: string;
  startParam?: string;
}

function botIdFromToken(botToken: string): number | null {
  const id = Number(botToken.split(":")[0]);
  return Number.isFinite(id) ? id : null;
}

function buildDataCheckString(initData: string, exclude: Set<string>): string {
  const params = new URLSearchParams(initData);
  return [...params.entries()]
    .filter(([key]) => !exclude.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function hmacMatches(
  initData: string,
  botToken: string,
  hash: string,
  exclude: Set<string>,
): boolean {
  const dataCheckString = buildDataCheckString(initData, exclude);
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken.trim())
    .digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  return calculatedHash === hash;
}

function validateHmac(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    return false;
  }

  // Telegram clients differ: some sign with `signature` in the payload, some without.
  return (
    hmacMatches(initData, botToken, hash, new Set(["hash"])) ||
    hmacMatches(initData, botToken, hash, new Set(["hash", "signature"]))
  );
}

function toValidated(initData: string): ValidatedInitData | null {
  const parsed = parse(initData);
  const user = parsed.user as TelegramWebAppUser | undefined;
  const authDate = parsed.authDate as Date | undefined;
  if (!user || !authDate) return null;

  return {
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      language_code: user.language_code,
      is_premium: user.is_premium,
    },
    authDate: Math.floor(authDate.getTime() / 1000),
    queryId: parsed.queryId as string | undefined,
    startParam: parsed.startParam as string | undefined,
  };
}

export async function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86_400,
): Promise<ValidatedInitData | null> {
  if (!initData) return null;

  const token = botToken.trim();
  const options = { expiresIn: maxAgeSeconds };

  if (validateHmac(initData, token, maxAgeSeconds)) {
    return toValidated(initData);
  }

  const botId = botIdFromToken(token);
  if (botId) {
    const ok = await isValid3rd(initData, botId, options);
    if (ok) return toValidated(initData);
  }

  return null;
}
