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

  try {
    validate(initData, token, options);
    return toValidated(initData);
  } catch {
    /* try Ed25519 signature validation (newer Telegram clients) */
  }

  const botId = botIdFromToken(token);
  if (botId) {
    const ok = await isValid3rd(initData, botId, options);
    if (ok) return toValidated(initData);
  }

  return null;
}
