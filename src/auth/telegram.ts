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

type ParsedInitData = ReturnType<typeof parse>;

function botIdFromToken(botToken: string): number | null {
  const id = Number(botToken.split(":")[0]);
  return Number.isFinite(id) ? id : null;
}

function toValidated(initData: string): ValidatedInitData | null {
  const parsed = parse(initData) as ParsedInitData & {
    auth_date?: Date;
    query_id?: string;
    start_param?: string;
  };

  const user = parsed.user as TelegramWebAppUser | undefined;
  const authDate = parsed.auth_date;
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
    queryId: parsed.query_id,
    startParam: parsed.start_param,
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
    /* try Ed25519 signature validation */
  }

  const botId = botIdFromToken(token);
  if (botId) {
    const ok = await isValid3rd(initData, botId, options);
    if (ok) return toValidated(initData);
  }

  return null;
}
