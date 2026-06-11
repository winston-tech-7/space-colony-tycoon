CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colonies (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (telegram_id) ON DELETE CASCADE,
  planet_id TEXT NOT NULL,
  planet_name TEXT NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  energy INTEGER NOT NULL DEFAULT 100,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, planet_id)
);

CREATE TABLE IF NOT EXISTS creatures (
  id SERIAL PRIMARY KEY,
  colony_id INTEGER NOT NULL REFERENCES colonies (id) ON DELETE CASCADE,
  species_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),
  stage TEXT NOT NULL CHECK (stage IN ('egg', 'juvenile', 'adult', 'evolved')),
  hunger INTEGER NOT NULL DEFAULT 0 CHECK (hunger >= 0 AND hunger <= 100),
  evolution_progress INTEGER NOT NULL DEFAULT 0 CHECK (evolution_progress >= 0 AND evolution_progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colonies_user ON colonies (user_id);
CREATE INDEX IF NOT EXISTS idx_creatures_colony ON creatures (colony_id);
CREATE INDEX IF NOT EXISTS idx_creatures_rarity ON creatures (rarity);
