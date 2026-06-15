import { useEffect, useMemo } from "react";

interface TgWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  initDataUnsafe: { start_param?: string };
  themeParams: Record<string, string>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    showProgress: (leave?: boolean) => void;
    hideProgress: () => void;
    enable: () => void;
    disable: () => void;
  };
  HapticFeedback?: { impactOccurred: (s: "light" | "medium" | "heavy") => void };
}

export function useTelegram() {
  const tg = (window as unknown as { Telegram?: { WebApp: TgWebApp } }).Telegram
    ?.WebApp;

  const startParam = useMemo(() => {
    const fromTg = tg?.initDataUnsafe.start_param;
    const fromUrl = new URLSearchParams(window.location.search).get("startapp");
    return fromTg ?? fromUrl ?? undefined;
  }, [tg]);

  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#0a0e17");
    tg.setBackgroundColor?.("#0a0e17");
    Object.entries(tg.themeParams).forEach(([k, v]) => {
      document.documentElement.style.setProperty(
        `--tg-theme-${k.replace(/_/g, "-")}`,
        v,
      );
    });
  }, [tg]);

  return { tg, initData: tg?.initData ?? "", startParam };
}
