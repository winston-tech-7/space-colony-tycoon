import crypto from "node:crypto";
import {
  isValid3rd,
  parse,
  validate,
} from "@telegram-apps/init-data-node";

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

/** Telegram expects URL-encoded values in the data-check string (not decoded). */
function buildRawDataCheckString(
  initData: string,
  exclude: Set<string>,
): string {
  return initData
    .split("&")
    .filter((chunk) => {
      const key = chunk.split("=")[0] ?? "";
      return key && !exclude.has(key);
    })
    .sort((a, b) =>
      (a.split("=")[0] ?? "").localeCompare(b.split("=")[0] ?? ""),
    )
    .join("\n");
}

function validateHmacRaw(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
): boolean {
  const hash = initData
    .split("&")
    .find((p) => p.startsWith("hash="))
    ?.slice(5);
  if (!hash) return false;

  const authChunk = initData.split("&").find((p) => p.startsWith("auth_date="));
  const authDate = Number(authChunk?.slice("auth_date=".length));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    return false;
  }

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken.trim())
    .digest();

  for (const exclude of [new Set(["hash"]), new Set(["hash", "signature"])]) {
    const dataCheckString = buildRawDataCheckString(initData, exclude);
    const calculated = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");
    if (calculated === hash) return true;
  }

  return false;
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

  if (validateHmacRaw(initData, token, maxAgeSeconds)) {
    return toValidated(initData);
  }

  try {
    validate(initData, token, options);
    return toValidated(initData);
  } catch {
    /* try library / Ed25519 paths */
  }

  const botId = botIdFromToken(token);
  if (botId) {
    const ok = await isValid3rd(initData, botId, options);
    if (ok) return toValidated(initData);
  }

  return null;
}
