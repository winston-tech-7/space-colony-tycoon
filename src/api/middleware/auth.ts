import type { Request, Response, NextFunction } from "express";
import {
  validateInitData,
  type ValidatedInitData,
} from "../../auth/telegram.js";
import { config } from "../../config.js";

export interface AuthedRequest extends Request {
  telegramAuth?: ValidatedInitData;
}

export async function telegramAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const initData =
    (req.headers["x-telegram-init-data"] as string) ||
    (req.query.initData as string);

  if (!initData) {
    res.status(401).json({ error: "Missing initData" });
    return;
  }

  const auth = await validateInitData(initData, config.botToken);
  if (!auth) {
    console.warn(
      "initData rejected",
      "hasHash=" + initData.includes("hash="),
      "hasSignature=" + initData.includes("signature="),
      "botId=" + config.botToken.split(":")[0],
    );
    res.status(401).json({ error: "Invalid initData" });
    return;
  }

  req.telegramAuth = auth;
  next();
}
