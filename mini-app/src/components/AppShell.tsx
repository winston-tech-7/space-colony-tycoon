import type { ReactNode } from "react";
import { getTab, type TabId } from "../lib/schema";
import { BottomNav } from "./BottomNav";
import { CurrencyBar } from "./CurrencyBar";

interface Props {
  children: ReactNode;
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  credits: number;
  medals: number;
  tokens: number;
  energy?: number;
  connected: boolean;
  status?: string;
}

export function AppShell({
  children,
  activeTab,
  onTabChange,
  credits,
  medals,
  tokens,
  energy,
  connected,
  status,
}: Props) {
  const tab = getTab(activeTab);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-main">
          <span className="top-bar-emoji">{tab?.emoji ?? "🪐"}</span>
          <div>
            <h1 className="top-bar-title">{tab?.title ?? "Space Colony"}</h1>
            {status && <p className="top-bar-status">{status}</p>}
          </div>
        </div>
        <CurrencyBar
          credits={credits}
          medals={medals}
          tokens={tokens}
          energy={energy}
          connected={connected}
        />
      </header>

      <main className="screen-content">{children}</main>

      <BottomNav active={activeTab} onChange={onTabChange} />
    </div>
  );
}
