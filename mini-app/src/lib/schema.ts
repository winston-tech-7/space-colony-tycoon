import schema from "../../schema.json";

export type TabId =
  | "home"
  | "collection"
  | "marketplace"
  | "leaderboard"
  | "events"
  | "settings";

export interface AppSchema {
  app: { id: string; name: string; version: string; locale: string; theme: string };
  theme: { colors: Record<string, string> };
  navigation: {
    type: string;
    tabs: Array<{ id: TabId; title: string; emoji: string }>;
  };
  screens: Array<{ id: TabId; layout: string; actions?: string[] }>;
}

export const appSchema = schema as AppSchema;

export function getTab(id: TabId) {
  return appSchema.navigation.tabs.find((t) => t.id === id);
}
