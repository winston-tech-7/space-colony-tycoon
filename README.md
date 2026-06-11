# Space Colony Tycoon 2.0

Telegram-native космическая MMO: **8 режимов**, **5 активны** (Colony, Guild, Trading, Battle Arena, AI Admiral).

**Стек:** Node.js · TypeScript · grammY · Express · Socket.io · React · Prisma · PostgreSQL · Redis

---

## MVP 2.0 — что работает

| Режим | Статус | Описание |
|-------|--------|----------|
| 🏭 Colony Builder | ✅ | Idle-сбор ресурсов, breeding, кормление |
| ⚔️ Guild Wars | ✅ | Создание/вступление, сезонные войны, power rating |
| 🏪 Trading Hub | ✅ | P2P листинги, покупка за кредиты |
| 🥊 Battle Arena | ✅ | Turn-based PvP, рейтинг, Socket.io |
| 🤖 AI Admiral | ✅ | GPT-4o-mini или rule-based, 3/день free |
| 🚀 Expedition | 🔜 Phase 3 | Stub + inline team search |
| 🧬 Genetic Lab | 🔜 Phase 3 | Stub |
| 📖 Storyline | 🔜 Phase 3 | Stub |

### Бот
- Команды: `/start`, `/colony`, `/feed`, `/guild`, `/market`, `/battle`, `/admiral`, `/modes`, `/help`
- Inline: `@bot rare`, `@bot battle`, `@bot expedition mars`, `@bot market phoenix`
- Webhook + Stars (опционально)

### Mini App (React)
- Навигация по 8 режимам
- Canvas-анимация планеты
- Socket.io live indicator
- MainButton для кормления (Colony)

---

## Быстрый старт

```bash
cd space-colony-tycoon
cp .env.example .env
# BOT_TOKEN, BOT_USERNAME, WEBAPP_URL

docker compose up -d
npm install
npm run db:push
npm run build
npm run dev
```

### BotFather
1. `/newbot` → токен
2. Inline Mode → **On**
3. Menu Button → Web App → `WEBAPP_URL`
4. Mini Apps: `colony`, `guild`, `market` (или один URL + `startapp`)
5. (Опционально) Payments → Stars → `STARS_ENABLED=1`

---

## Архитектура

```
src/
├── modes/           # Модульная игровая логика
│   ├── colony/      # ✅ Phase 1
│   ├── guild/       # ✅ Phase 2
│   ├── trading/     # ✅ Phase 1
│   └── stubs.ts     # 🔜 остальные режимы
├── bot/             # grammY: команды, inline
├── api/             # Express REST
├── realtime/        # Socket.io + Redis pub/sub
└── db/prisma.ts

mini-app/src/        # React SPA
├── modes/           # UI по режимам
└── components/      # PlanetCanvas, ModeNav

prisma/schema.prisma # Полная схема 2.0
docs/MODULES.md      # Как добавить Phase 2–4
```

---

## API

Заголовок: `X-Telegram-Init-Data`

| Endpoint | Описание |
|----------|----------|
| `GET /api/me` | Профиль + режимы |
| `POST /api/colony/feed` | Кормление |
| `GET /api/guild/me` | Моя гильдия |
| `POST /api/guild/create` | Создать гильдию |
| `POST /api/guild/join` | Вступить |
| `POST /api/guild/war` | Начать войну |
| `GET /api/market` | Листинги |
| `POST /api/market/list` | Выставить |
| `POST /api/market/buy` | Купить |
| `GET /api/battle` | Бои, вызовы, рейтинг |
| `POST /api/battle/challenge` | Бросить вызов |
| `POST /api/battle/:id/turn` | Ход (attack/defend) |
| `POST /api/admiral` | Совет AI Admiral |
| `GET /api/admiral/history` | История советов |
| `GET /api/modes/:id/stub` | Заглушка режима |

WebSocket: `socket.io` с auth `initData`.

---

## Deep links

```
t.me/spacecolonybot?start=ref_123
t.me/spacecolonybot/guild?startapp=join_ALPHA
t.me/spacecolonybot/battle?startapp=challenge_456
t.me/spacecolonybot/market?startapp=nft_auction_789
```

---

## Добавление модулей

См. [docs/MODULES.md](docs/MODULES.md) — пошаговый гайд для Battle Arena, AI Admiral, Expedition, Genetic Lab, Storyline.

---

## Out of scope

VR/AR, DeFi, voice chat, ML breeding, cross-platform sync.
