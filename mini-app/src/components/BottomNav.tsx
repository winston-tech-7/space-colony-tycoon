import { appSchema, type TabId } from "../lib/schema";

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function BottomNav({ active, onChange }: Props) {
  const tabs = appSchema.navigation.tabs;

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`bottom-nav-item ${active === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav-emoji">{tab.emoji}</span>
          <span className="nav-label">{tab.title}</span>
        </button>
      ))}
    </nav>
  );
}
