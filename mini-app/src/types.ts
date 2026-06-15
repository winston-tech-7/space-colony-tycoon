export type GameModeId =
  | "colony"
  | "guild"
  | "trading"
  | "battle"
  | "expedition"
  | "genetic"
  | "admiral"
  | "storyline";

export interface GameMode {
  id: GameModeId;
  name: string;
  emoji: string;
  phase: number;
  implemented: boolean;
  deepLink: string;
  description: string;
}

export interface Creature {
  id: number;
  name: string;
  speciesId: string;
  rarity: string;
  stage: string;
  hunger: number;
  evolutionProgress: number;
  feedCount?: number;
  powerLevel?: number;
}

export interface Egg {
  id: number;
  status: string;
  rarityTier: string | null;
  readyAt: string;
  openedAt: string | null;
  parentAId: number | null;
  parentBId: number | null;
  boostLevel?: number;
}

export interface Colony {
  id: number;
  planetId?: string;
  planetName: string;
  level: number;
  energy: number;
  minerals: number;
  bioMatter: number;
  mineLevel?: number;
  bioLabLevel?: number;
  isPremium: boolean;
}

export interface Profile {
  telegramId?: string;
  credits: number;
  medals: number;
  tokens: number;
  totalFeeds?: number;
  referralCode?: string | null;
  colonies: Colony[];
  creatures: Creature[];
  eggs?: Egg[];
  guildMemberships: Array<{
    guildId: number;
    role: string;
    guild: {
      id: number;
      name: string;
      tag: string;
      memberCount: number;
      powerRating: number;
      warsAs1?: Array<{ guild1Score: number; guild2Score: number; status: string }>;
      warsAs2?: Array<{ guild1Score: number; guild2Score: number; status: string }>;
    };
  }>;
}

export interface BattleState {
  id: number;
  status: string;
  turn: number;
  p1Hp: number;
  p2Hp: number;
  currentTurn: string | null;
  winnerId: string | null;
  log: Array<{ turn: number; text: string }>;
  player1: { id: string; name: string };
  player2: { id: string; name: string };
  creature1: { id: number; name: string; rarity: string; power: number } | null;
  creature2: { id: number; name: string; rarity: string; power: number } | null;
}

export interface MarketListing {
  id: number;
  priceCredits: number;
  priceStars: number;
  creature: Creature;
  seller: { firstName: string; username: string | null };
  species?: { emoji: string };
}

export interface Quest {
  id: string;
  title: string;
  target: number;
  rewardMedals: number;
  progress: number;
  completed: boolean;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  score: number;
  totalFeeds: number;
  medals: number;
}
