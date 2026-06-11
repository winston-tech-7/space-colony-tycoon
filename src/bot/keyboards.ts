import { InlineKeyboard, Keyboard } from "grammy";
import { config, miniAppUrl } from "../config.js";
import { GAME_MODES } from "../modes/registry.js";

export function mainMenuKeyboard(): Keyboard {
  const kb = new Keyboard();
  if (config.webappUrl) {
    kb.webApp("🚀 КОЛОНИЯ", config.webappUrl);
  } else {
    kb.text("🚀 КОЛОНИЯ");
  }
  return kb
    .text("⚔️ Гильдия")
    .text("🏪 Маркет")
    .row()
    .text("📊 Статус")
    .text("🍽 Кормление")
    .row()
    .text("❓ Помощь")
    .resized();
}

export function modePickerKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const mode of GAME_MODES.filter((m) => m.implemented)) {
    kb.url(`${mode.emoji} ${mode.name}`, miniAppUrl(mode.id)).row();
  }
  return kb;
}

export function openModeKeyboard(
  mode: "colony" | "guild" | "trading" | "market" | "battle" | "admiral",
  payload?: string,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const startapp =
    payload ?? (mode === "trading" || mode === "market" ? "market" : mode);
  const url = config.webappUrl
    ? startapp === "colony"
      ? config.webappUrl
      : `${config.webappUrl}?startapp=${encodeURIComponent(startapp)}`
    : miniAppUrl(mode, payload);

  if (config.webappUrl) {
    kb.webApp("🚀 Открыть", url);
  } else {
    kb.url("🚀 Открыть", miniAppUrl(mode, payload));
  }
  return kb;
}
