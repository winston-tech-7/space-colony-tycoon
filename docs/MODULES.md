# Добавление игровых модулей (Phase 2–4)

MVP 2.0 включает **5 режимов**: Colony, Guild, Trading, **Battle Arena**, **AI Admiral**. Остальные 3 — заглушки.

## Структура модуля

```
src/modes/{mode}/
  service.ts    # бизнес-логика
  routes.ts     # (опционально) подроутер Express
mini-app/src/modes/{Mode}Mode.tsx
```

## Чеклист нового режима

1. **Prisma** — таблицы уже в `prisma/schema.prisma`
2. **`src/modes/registry.ts`** — `implemented: true`
3. **`src/modes/{mode}/service.ts`** — логика
4. **`src/api/routes.ts`** — REST эндпоинты
5. **`src/bot/inline.ts`** — viral sharing
6. **`mini-app/src/modes/{Mode}Mode.tsx`** — UI
7. **`mini-app/src/App.tsx`** — роутинг режима
8. **`src/realtime/socket.ts`** — room `join:{mode}` при необходимости

## ✅ Battle Arena (реализован)

- `src/modes/battle/service.ts` — challenge, accept, turn-based combat
- API: `/api/battle/*`
- Socket.io: `battle:update`, `battle:challenge`
- Phase 4: real-time вместо turn-based

## ✅ AI Admiral (реализован)

```env
OPENAI_API_KEY=sk-...
```

- `src/modes/admiral/service.ts` — GPT-4o-mini или rule-based fallback
- Лимит: 3 совета/день (free), безлимит для tier Admiral
- API: `POST /api/admiral`, `GET /api/admiral/history`

## Phase 3: Expedition

Используйте `expeditions` + `expedition_participants`. Inline: `@bot expedition mars`.

## Phase 3: Genetic Lab + TON NFT

```typescript
// traits_json на creatures → nft_metadata + tonweb mint
```

## Phase 3: Storyline

JSON квесты + `seasonal_progress` для наград Battle Pass.

## Deep links (BotFather)

Создайте Mini App short names в BotFather или используйте один SPA:

| Режим | URL |
|-------|-----|
| Guild | `t.me/bot/guild?startapp=join_ALPHA` |
| Battle | `t.me/bot/battle?startapp=challenge_123` |
| Market | `t.me/bot/market?startapp=nft_auction_456` |
