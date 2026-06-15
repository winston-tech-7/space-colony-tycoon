# Build a prototype similar to DUCK × MY × DUCK

> Before reading — open `METHODOLOGY.md` in this folder. This PROMPT references its patterns
> (intent-pattern, identity-bridge, anti-zombie push, Stars vs Cards, display-vs-charge currency).
> References like `ch. 10` point to its chapters.

---

## What this app does

DUCK × MY × DUCK is a Telegram-native casual breeding-simulator collectible game where players feed, breed, trade, and hunt rare ducks to earn rewards. Over 1 million active players access the entire gameplay experience inside a SvelteKit-powered Mini App launched from the bot's menu button. The core loop is: feed ducks → breed offspring → crack eggs for rare variants → trade on a marketplace → hunt legendary ducks for event prizes.

Monetization spans four currencies: Telegram Stars (premium item purchases), TON (marketplace trades, duck listings), in-game medals (Lucky Wheel spins), and game tokens (secondary rewards). Price ladder spans 100 medals (wheel spin) to 5,999 Stars (legendary prizes). The bot's /start message is minimal—three CTAs (Play Now, Subscribe, Terms)—keeping friction low for onboarding.

The target audience is casual mobile gamers and TON-ecosystem enthusiasts. Community channels (@duckmyduck_official, @duckerssup) drive retention and support. The game's idleness and social breeding mechanics encourage daily check-ins and friend referrals.

## Key features

- **Duck Feeding** — Idle-game core loop: players feed ducks regularly to earn points and keep flocks active. Idempotency: feeding is time-gated; backend must reject duplicate feed calls within the same epoch.
- **Duck Breeding** — Social mechanic: pair player's duck with a friend's duck to produce offspring. Idempotency: breeding transaction must be atomic (debit both parents, credit egg) and deduplicate retry requests by breeding session ID.
- **Egg Cracking & Rare Rewards** — Gacha-style reward reveal: crack eggs to discover rare/legendary duck variants. Anti-fraud: server must assign rarity tier before client opens envelope; client never sees raw seed.
- **Duck Trading Marketplace** — List/buy ducks for TON (0.02–105 TON range) or Stars. Multi-currency pricing: TON prices stored separately from Stars prices. Escrow logic: lock duck on seller's side until payment confirmed on-chain.
- **Lucky Wheel Spin** — Roulette mechanic: spend 100 medals per spin for bonus rewards. Atomic transaction: debit medals, assign prize, credit reward in a single DB write; replay-proof via spin ID.
- **Legendary Duck Hunts** — Time-limited events: rare ducks appear; most active hunters earn exclusive prizes. Event state machine: open → in-progress → closed → claimed. Anti-race: use DB row-level locks on event participation.
- **Community Channel Integration** — Bot suggests subscription to @duckmyduck_official for announcements and events. Verify subscription at /start; no paywall enforcement, soft incentive only.

## Languages

Primary: `en`. Localize UI strings in the Mini App (SvelteKit store) via a user profile property or localStorage, not per-language event streams—see METHODOLOGY.md ch. 21.

## App structure (screen graph)

**Depth 0 (Onboarding):** `/start`  
**Depth 1 (Branches):** 🦆 Play Now | Subscribe To The Channel | Terms of Use  
**Depth 2+ (Gameplay Mini App):** Home (duck + actions) | Feed | Collection | Egg Crack | Breeding | Marketplace | Detail Stats | Lucky Wheel | Leaderboard | Legendary Hunt | Reward Card | Payment (Stars/TON) | Staking | Tasks/Quests | Tutorial | Settings/Profile | Friends/Referral | Flock Grid | Notification Overlay | Chat/Messaging | Seasonal Events

See `schema.json` for the full graph and `screens/` for the visual unfold.

## Reference screenshots

See `./screens/`:
- `01-home.png` — Mini App landing: player's main duck, feed/breed/marketplace/wheel CTAs, duck grid preview.
- `02-feed.png` — Feeding interaction: tap duck, earn points, time-gate countdown.
- `03-collection.png` — Inventory: all owned ducks, rarity badges, stats bar.
- `04-egg-crack.png` — Gacha reveal: egg shatters, rarity tier animates in (rare/legendary emphasis).
- `05-breeding.png` — Pairing interface: select friend's duck, confirm breeding cost, egg countdown timer.
- `06-marketplace.png` — Trading listings: duck grid with TON/Stars dual-price tags, sort by rarity/price.
- `07-detail.png` — Duck stats panel: name, rarity, feed count, breeding history, market value.
- `08-lucky-wheel.png` — Roulette spinner: medal cost, spinning animation, prize highlight.
- `09-leaderboard.png` — Ranking: top players by feed count/hunt score, avatar + username + score.
- `10-legendary-hunt.png` — Event screen: current legendary duck portrait, hunt timer, participation counter.
- `11-reward-card.png` — Prize reveal: card animation, rarity glow, "Claim" CTA.
- `12-payment.png` — Stars/TON selector: logo, amount, price breakdown, "Buy" button.
- `13-staking.png` — Passive income view: locked ducks, reward accrual countdown, unlock CTA.
- `14-tasks.png` — Quests widget: daily/weekly tasks, reward preview, progress bar.
- `15-tutorial.png` — Onboarding walkthrough inside Mini App: feed → breed → crack flow, skip option.
- `16-settings.png` — Profile panel: username, avatar, notification toggles, language picker, referral link.
- `17-friends.png` — Social screen: connected friends, referral bonus tracker, invite CTA.
- `18-flock-grid.png` — Expanded collection: all ducks in grid, search/filter by rarity.
- `19-notification-overlay.png` — Pop-up: "Your egg is ready!" with dismiss/open CTA.
- `20-messaging.png` — Chat list or in-app DMs with other players (if enabled).
- `21-seasonal.png` — Event/bonus banner: limited-time duck variant, countdown timer, entry fee.

**Visual code you must NOT break:**
- **Theme:** Cute, pastel primary colors (yellows, light blues, soft greens) with white backgrounds. Ducks are the visual anchor (cartoony, playful style).
- **Accents:** Gold/bright yellow for premium (Stars, legendary ducks), cyan/teal for TON integrations, warm orange for rewards/bonuses.
- **Typography:** Rounded sans-serif (e.g., Quicksand, Nunito) for headings; clean body font for stats/labels.
- **Buttons:** Soft-rounded rectangles with drop shadows; CTA buttons use gradient fills (yellow→orange or cyan→teal).
- **Icons:** Emoji (🦆, ⭐, 💎) mixed with custom iconography; animated state changes (spinning wheel, egg crack, breeding hearts).
- **Spacing:** Generous padding; card-based layout for game sections; bottom-safe navigation bar on mobile.

## Detected tech stack

- **Mini App** (`https://selector.duckmyduck.com`): SvelteKit, Sentry, Telegram Web App SDK, Google Fonts, Capacitor, Hammer.js, TON Connect.
- **Bot** (inferred): long-polling stack (aiogram/grammy or similar Python/JS Telegram framework), payment rails for Stars and TON invoice handling, session store (Redis or in-memory for active players).

---

## Build instructions (methodology-aligned)

### 1. Architecture & identity bridge (ch. 2, 3, 4)

**Three-process model:** Deploy as Bot Service (long-polling Telegram API, /start handler, payment callbacks), Mini App Backend (SvelteKit, game state, marketplace ledger), and Database (PostgreSQL for duck inventory, marketplace, user sessions).

**Identity bridge:** 
- Bot receives `initData` (user ID, hash) on Mini App launch.
- Pass `initData` to SvelteKit via POST `/auth` endpoint; verify signature using bot token (see ch. 3, identity-bridge).
- On success, issue a short-lived JWT (15 min) + refresh token (7 days) stored in HTTP-only cookies.
- Mini App uses JWT for all game API calls; Bot never needs to re-verify unless JWT expires.

**Auth strategy:** 
- No username/password. Telegram user ID is the primary key.
- Store `(user_id, tg_username, avatar_url, created_at, last_active_at)` in `users` table.
- Secrets (bot token) stored in environment, never exposed to client. See ch. 4 (Auth & Secrets).

### 2. Core game state & idempotency (ch. 2, 5, 8)

**Duck inventory model:**
```
ducks(id, user_id, rarity, name, feed_count, last_fed_at, status: 'active|staked|breeding', created_at)
eggs(id, user_id, parent_a_id, parent_b_id, status: 'cracking|ready', rarity_tier: NULL initially, created_at)
breeding_sessions(id, initiator_id, partner_id, parent_a_id, parent_b_id, egg_id, status, created_at)
marketplace(id, seller_id, duck_id, price_ton, price_stars, status: 'listed|sold|cancelled', created_at)
```

**Idempotency keys:**
- **Feeding:** Use `(user_id, duck_id, epoch_timestamp)` as idempotency key. Backend rejects duplicate feed calls within 1 minute.
- **Breeding:** Generate `breeding_session_id` client-side (UUID); server deduplicates by session ID before debiting both parents. Egg creation is atomic within the breeding transaction.
- **Wheel spin:** Assign `spin_id` (UUID) before processing; store in `spin_history(spin_id, user_id, medal_debit, prize_id, claimed_at)`. Reject replays by checking `spin_id` uniqueness.
- **Egg crack:** Once rarity tier is assigned (server-side, never exposed until crack), store `crack_request_id`; prevent double-cracks by checking `eggs.opened_at`.

**Race condition safety (ch. 8):**
- Use `SELECT ... FOR UPDATE` on duck rows during breeding to prevent selling the same duck twice.
- Marketplace sales: lock seller's duck, lock buyer's wallet balance, then swap. All in a single transaction.
- Legendary hunt: use row-level lock on `events(event_id)` to atomically increment participant count and assign hunt reward.

### 3. Multi-currency payments (ch. 10)

**Currency model:**
- **Telegram Stars:** Client-side purchase via Telegram's native in-app payment widget. Bot receives `pre_checkout_query` → responds with `answerPreCheckoutQuery`, then `successful_payment` callback. Stars stored in `user_balances(user_id, stars_balance, last_updated)`.
- **TON:** Integrate TON Connect 2.0 (Capacitor + `@ton/ton` SDK). User signs transaction, app polls `getTransactionStatus` to confirm on-chain settlement. Store TON wallet address in `users(ton_wallet_address, ton_balance_timestamp)`.
- **In-game medals:** Earn via feeding (1 medal per 10 feeds), breeding events, hunt participation. Store in `user_resources(user_id, medals, tokens, updated_at)`.
- **Game tokens:** Secondary reward currency (rarer drops from eggs, staking rewards).

**Purchase flow:**
1. User taps "Buy Legendary Prize (5,999 Stars)" → client sends POST `/purchase-intent` with duck/prize ID.
2. Backend generates Telegram invoice: `sendInvoice(user_id, title, description, payload, currency="XTR", prices=[...])`.
3. Bot's `pre_checkout_query` handler approves.
4. User confirms payment in Telegram UI → bot receives `successful_payment` callback.
5. Backend credits duck/prize to user's inventory, logs transaction, emits analytics event.
6. Mini App listens for purchase completion (via webhook or polling) and refreshes inventory.

**Marketplace (TON escrow):**
- Seller lists duck with TON price → duck marked `status='listed'`, locked in seller's inventory.
- Buyer initiates purchase → backend creates TON invoice with seller's wallet as recipient.
- TON payment completes → backend atomically moves duck to buyer, removes from seller.
- If payment fails or times out (5 min), unlock seller's duck.

### 4. Mini App UX & navigation (ch. 16, 17)

**Native mini app widgets:**
- Use Telegram WebApp API (`window.Telegram.WebApp`) for:
  - `setHeaderColor()` — set top bar to match theme (pastel yellow or white).
  - `setBackButtonVisible(true/false)` — show back button on detail screens.
  - `onBackButtonClicked()` — handle pop-state for breeding/marketplace detail exits.
  - `HapticFeedback.impactOccurred('light')` — tap feedback on feed/breed/spin actions.
  - `MainButton` — make prominent "Feed Duck" or "Spin Wheel" action stickied to bottom.

**Navigation (ch. 17):**
- Bottom tab bar: Home | Collection | Marketplace | Leaderboard | Events | Settings.
- Use SvelteKit page routes (`/home`, `/collection`, `/marketplace/{id}`, etc.) for deep linking within Mini App.
- Preserve navigation state: if user leaves Marketplace list and returns, keep scroll position via scroll-restoration store.
- Modal overlays (breeding confirm, payment confirm) use a SvelteKit modal stack, not full-page navigation.

**Responsive design:**
- Mobile-first: test on iPhone SE (320px) and flagship Android (412px).
- Safe areas: use `env(safe-area-inset-bottom)` for bottom navigation; Capacitor sets viewport-fit=cover.
- Gesture support: Hammer.js for swipe-to-dismiss on reward cards, pinch-to-zoom on duck detail images.

### 5. Payments UI & checkout flow

**Stars payment:**
- Mini App displays "Buy 5,999 Stars" button with checkmark icon.
- On click, backend sends `sendInvoice(...)` to bot; bot displays inline Telegram payment UI.
- User confirms in native Telegram UI (not in Mini App).
- After payment, bot notifies Mini App via webhook; app plays success animation, credits inventory.

**TON payment:**
- Use TON Connect 2.0 (`@ton/ton`, `@ton-connect/ui`).
- Display "Connect Wallet" → user selects wallet (TonKeeper, TonHub, etc.) → signs transaction.
- Backend validates transaction via `getTransactionStatus(address, txHash)`.
- On confirmation, credit duck to buyer, debit from seller (if marketplace).

**Fallback:** If payment fails, show retry dialog with transaction hash for manual support inquiry.

### 6. Legendary hunt & event FSM (ch. 7)

**Event state machine:**
- **open:** Event announced; ducks spawn in the world.
- **in_progress:** Players actively hunting; hunt counter increments.
- **closed:** Hunt deadline reached; no new participants accepted.
- **claimed:** Prizes distributed to top hunters and participants.

**Participation logic:**
- User taps "Hunt" → backend increments `event_hunts(user_id, event_id, hunt_count, last_hunt_at)`.
- Rank users by `hunt_count DESC` within the event window.
- Top 10 earn exclusive legendary duck variant; all participants earn medal bonus.
- Use DB row-level lock during rank calculation to prevent race conditions.

### 7. Push & retention (ch. 13, 14)

**Anti-zombie push (ch. 13):**
- Egg ready to crack: push "Your egg is ready! 🥚" at time of hatch (not on first boot after hatch).
- Legendary hunt spawning: push "New legendary duck appeared! Hunt now 🦆" only to active players (