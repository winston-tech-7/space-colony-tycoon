# The Ideal Telegram Project

**Bot + Mini App: architecture, interaction, UX, monetization, and pushes**
_Reference, 2026-06-03_

## Purpose of this document

This is a production-ready reference for a team (or an AI agent with a Claude API key) that, given only the architectural map of a specific app (`PROMPT.md` + `schema.json` + `screens/`), must build out a complete, high-quality Telegram stack: bot, mini app, backend, events, tone, payment and push patterns.

This file is meant to be:

- **The mandatory substrate for the remix archive** — placed next to `PROMPT.md`, it lifts a prototype from "single-pager" to "production-ready system".
- **A code-review checklist** — walk the chapters → are the patterns implemented?
- **Context for AI generation** — give the LLM this file + a specific bot's `PROMPT.md` → you get not "yet another prototype" but a solution where intent-pattern, identity-bridge, anti-zombie push mechanics, and a safe paywall with multi-currency are already built in architecturally.

**The main rule.** The user came to Telegram, not to your app. That means: chat is the primary interface, the mini app is an extension, not a replacement. Any step that pulls the user outside (to a browser, email, SMS) costs 30-50% of conversion. If you can't do it inside Telegram — ask yourself why you need a mini app at all.

---

## 1. What "the ideal Telegram project" means

Ideal = Telegram-native, not "a web app opened inside Telegram". That is what distinguishes a living product from a wrapper.

An ideal Telegram project:

1. **Has an entry point from the bot, from the mini app, and via deep link.** The user can come from anywhere — the result is the same.
2. **Requires no login** — `initData` HMAC verification does this for free.
3. **Shows no corporate tone**, doesn't pressure with "get an offer", doesn't use the word "free" in routine texts.
4. **Has a trigger → 1-2 steps → payment.** Every intermediate screen = -20-50% conversion.
5. **Treats engagement as more important than pushes** — pushes don't create value, they only remind of it.
6. **Never shows RUB prices to a Ukrainian user** (even if they chose the Russian interface themselves).

These six rules pull a team out of 80% of typical mistakes before they make them.

---

## 2. Architecture: repositories and processes

### 2.1. Minimum — three processes

| Process | Stack | What it does | What it does NOT do |
|---|---|---|---|
| **Bot** | Python aiogram / Node grammy, long polling | Receives updates, runs the FSM, sends messages, handles callbacks, holds the push cron and AMQP workers | Doesn't store business data. Doesn't serve HTTP requests from the mini app. Doesn't call AI directly (let the backend do it). |
| **Backend / API** | FastAPI / Express / NestJS | Source of truth for data. Validates `initData`. Calls AI. Calls the bot over an internal channel. Payment webhooks. | Doesn't listen to Telegram updates. Doesn't hold the FSM. |
| **Mini App** | React + Vite (Webpack), TypeScript, hosted on Vercel or your own CDN | Renders screens. Calls the backend over HTTPS. | Doesn't call the Telegram Bot API. Doesn't store secrets. |

### 2.2. Optional — a fourth: exposed-api

If you have public endpoints (configs, geo, prices, FX rates) served without auth and cached on a CDN — it's safer to move them into a separate service so you don't expose the structure of the main backend.

Typical example: a separate `exposed-api` service serves prices and geo data without auth, while the main backend is invisible from outside. This removes a whole class of security research: "let's see which endpoints exist".

### 2.3. Why three, not one

- **"Everything in the bot"** — a bot on long polling is blocked by any synchronous error; any slow request makes it deaf. The backend offloads the work and gives the mini app a proper HTTP interface.
- **"Bot inside the backend"** — on backend restart, long polling breaks, updates are lost, the in-memory FSM dies. Split them — you gain resilience.
- **"Mini app calls the Telegram Bot API directly"** — the token leaks on day one.

### 2.4. Where state lives

| Layer | What | Durability |
|---|---|---|
| Postgres / Mongo | Users, products, messages, subscriptions, events | Permanent |
| FSM (MemoryStorage / Redis) | Current conversation step, temporary `file_id`, `ack_msg_id` | Until restart or N hours |
| JSON files (`data/`) | Sharing between processes on one machine (bot saved → backend reads) | Ephemeral on dev; on prod → Redis or a DB table |
| localStorage in the mini app | UI state, streak days, "saw onboarding" flags | Permanent, but client-side |

Sharing via JSON only works on one machine. On prod, move it to Redis or a table. On dev — fine and cheap.

---

## 3. Identity bridge — the main cross-cutting principle

The same `distinct_id` = `String(telegram_user_id)` in the bot, in the mini app, and in all analytics events.

This lets you, in Mixpanel/Amplitude/custom analytics, link bot events (`Sign Up`, `Set Up`, `Got the message`, `Purchase`) with mini-app events (`Open MiniApp`, `paywall_viewed`, `pay_clicked`) into one funnel without identity-merge.

Identity-merge via the Mixpanel "stitch an anonymous user to a known one" feature is unstable: it breaks on browser change, localStorage clearing, or re-opening the mini app. Identification via `telegram_user_id` is stable forever — Telegram itself identifies the user.

**Ground rule:** before any cohort work, verify the `distinct_id` is the same. Otherwise you can't split "these users came from the push, those from the mini app".

```js
// bot
mixpanel.people.set({ distinct_id: user.user_id.toString() });
// mini app
mixpanel.identify(user.id.toString());
```

---

## 4. Authentication and secrets

### 4.1. BOT_TOKEN

Must match in the bot and the backend. The backend uses it for:

1. **HMAC verification of `initData`** from the mini app. If the tokens differ — all requests are rejected with 401.
2. **Downloading files from the Telegram CDN** by `file_id` (`getFile` + `/file/bot{token}/{path}`).

`BOT_TOKEN` must never be present in the mini app. Never. That is public code.

### 4.2. initData — the only reliable user identifier in the mini app

Rules:

- Never trust `initDataUnsafe.user.id` without HMAC verification — the client can rewrite it.
- No TTL needed. `initData` is unique to the current WebView session. Replay protection is impossible and not required.
- Pass `initData` either in the POST body (first line) or in the query (`?initData=...`) — the latter is needed for `<img src>` where the body isn't sent.

```js
// pseudocode for server-side verification (same for Python/Node)
function validateInitData(initDataString, botToken) {
    const params = new URLSearchParams(initDataString);
    const hash = params.get('hash');
    params.delete('hash');
    const dataCheckString = [...params.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join('\n');
    const secret = HMAC_SHA256(botToken, "WebAppData");
    const calculated = HMAC_SHA256(secret, dataCheckString);
    if (calculated !== hash) throw new Error('Unauthorized');
    return JSON.parse(params.get('user'));
}
```

### 4.3. PUSH_INTERNAL_TOKEN (internal channel)

A shared secret between the backend and the bot for the internal channel (the backend asks the bot to start a conversation, send a push, change the FSM). Passed in the `X-Internal-Token` header.

- The bot exposes an HTTP server on a separate port (push-server).
- The backend knows the URL and the token.
- Without the token — 401. So internal endpoints don't leak even if the URL is found.

### 4.4. ENCRYPTION_SECRET

If the app works with sensitive content (messages, media, personal data) — store it encrypted in the DB with a symmetric key that lives only in the env of the backend and the bot. Decryption is only possible with `BOT_TOKEN` + `ENCRYPTION_SECRET` simultaneously — both server-side only.

This gives you the marketing argument "protected by encryption" in the welcome — it removes the security fear that, for many app categories (privacy-tools, finance, dating), is the top reason for immediate uninstall.

### 4.5. AI keys (Gemini / OpenAI / Anthropic)

Backend only. Never in the mini app. The mini app calls `/api/analyze` — the backend downloads the data, sends it to the LLM, and returns structured JSON.

---

## 5. Data flows: how the processes talk

### 5.1. The base picture

```
Telegram CDN
     │
     │ updates, media, callbacks
     ▼
┌──────────┐                 ┌──────────┐
│   Bot    │── internal ─── │ Backend  │── Postgres / Mongo
│          │   /intent      │          │── AI (Gemini/GPT/Claude)
└──────────┘   /push        └──────────┘── Tribute / Stars webhooks
     ▲                            ▲
     │                            │ HTTPS + initData
     │ Telegram WebApp            │
     │                            │
     └─────────── Mini App ───────┘
```

Five "edges":

1. **Telegram → Bot** — long polling (or webhook for prod).
2. **Mini App → Backend** — HTTPS, authorized via `initData`.
3. **Backend → Bot** — internal HTTP with `X-Internal-Token`.
4. **Bot → Backend** — pushing events ("user subscribed, save it"). Same internal token.
5. **Payment systems → Backend** — webhook from Tribute/Stripe/etc.

### 5.2. Scenario A: user sends /start

```
Telegram → Bot middleware → create user in Mongo → welcome
                ↓
           analytics: Sign Up
```

### 5.3. Scenario B: user opens the mini app

```
Mini App: App.tsx loads initData
    ↓
fetch('/api/me', body: initData)
    ↓
Backend: validateInitData → user.id
    ↓
return { subscription, profile, ... }
```

### 5.4. Scenario C: a business event in the user's chat (Business API)

```
The user's contact deleted a message
    ↓
Telegram → Bot: deletedBusinessMessages webhook
    ↓
Bot: finds the original in Mongo → decrypts
    ↓
Bot: sends the user a preview under tg-spoiler + inline button [Restore]
```

### 5.5. Scenario D: payment

```
Mini App: tariff selected → POST /api/payments/create
    ↓
Backend: creates an order in the payment system → returns paymentUrl
    ↓
Mini App: tg.openLink(paymentUrl) or Telegram openInvoice
    ↓
[user pays]
    ↓
Payment provider → Backend webhook → activates the subscription
    ↓
Backend → Bot (/internal/notify): "user X has an active subscription, reply to them"
    ↓
Bot: bot.sendMessage(tg_id, "✓ Subscription active")
    ↓
Mini App: WebSocket / polling / Telegram open MiniApp with ?refresh=1
```

---

## 6. Intent-pattern — the mini app asks the bot to "start a conversation"

This is the central non-trivial pattern that solves the main systemic problem: `Telegram.WebApp.sendData(...)` silently fails to reach the bot if the mini app is opened via a menu button or inline keyboard. It works only for `reply_keyboard` — a rare scheme in modern apps.

### 6.1. The intent-channel architecture

```
Mini App                    Backend                       Bot (push-server)
   │                           │                              │
   │ POST /api/intent/X        │                              │
   │ Body: initData            │                              │
   ├─────────────────────────▶│                              │
   │                           │ authenticate(initData)       │
   │                           │ → tg_id                      │
   │                           │                              │
   │                           │ POST /intent                 │
   │                           │ X-Internal-Token             │
   │                           │ { tg_id, name, payload }     │
   │                           ├─────────────────────────────▶│
   │                           │                              │ set FSM state externally
   │                           │                              │ bot.sendMessage(tg_id, ..
   │                           │◀────────── 200 ──────────────┤
   │◀────────── 200 ───────────│                              │
```

### 6.2. Setting the FSM state from outside

When the backend wants the bot to "meet" the user's next message with a specific handler, there's no Telegram update yet — you need to set the FSM programmatically:

```python
# Python aiogram
from aiogram.fsm.storage.base import StorageKey
key = StorageKey(bot_id=bot.id, chat_id=tg_id, user_id=tg_id)
await dp.storage.set_state(key, AddRoutineState.collecting)
await dp.storage.set_data(key, {"file_ids": []})
```

The user's next message lands directly in the handler with this state. That's "we met them on the right screen".

### 6.3. When intent is justified

| Scenario | Use intent? |
|---|---|
| Start collecting photos / media in the chat | Yes |
| Open a PDF with the result | No, open it in the WebApp |
| Request payment | No, open the checkout flow |
| Confirm a rare action with words in the chat | Yes, start a short FSM |
| Send an admin message from tech support | Yes |

**Rule:** intent — when you need a reply in the chat. Anything handled inside the mini app — handle it there.

```js
// Node grammy
const sessionKey = `${tg_id}`;
await sessionStorage.write(sessionKey, { step: 'collecting', file_ids: [] });
await bot.api.sendMessage(tg_id, "Okay, send the photos — one by one.");
```

---

## 7. FSM states: aiogram / grammy, inside and out

### 7.1. The standard flow

A user message arrives → the bot routes it to a handler by current state → the handler reads/updates the state data → moves to the next state.

### 7.2. MemoryStorage vs Redis

| Storage | When |
|---|---|
| MemoryStorage | Dev, MVP, simple flows. On a crash the user just sends `/start` again — fine. |
| Redis | Prod, critical flows (payment started, verification in progress) — losing state = bad experience. |

Mature products combine in-memory FSM with a persistent DB (Mongo / Postgres). An MVP can get by with MemoryStorage only. This is a valid trade-off for different product maturity levels.

### 7.3. Setting state from outside (repeat from chapter 6)

```python
class OnboardingState(StatesGroup):
    waiting_photos = State()
    quiz_q1 = State()

@router.message(F.photo, OnboardingState.waiting_photos)
async def handle_photo(msg, state: FSMContext):
    data = await state.get_data()
    photos = data.get("photos", [])
    photos.append(msg.photo[-1].file_id)
    await state.update_data(photos=photos)

key = StorageKey(bot_id=bot.id, chat_id=tg_id, user_id=tg_id)
await dp.storage.set_state(key, MyState.step1)
await dp.storage.set_data(key, {"meta": ...})
```

---

## 8. Races and lock patterns

### 8.1. Media group race condition

**Symptom.** The user sends 3-5 photos "as one message" (an album). In reality these are N separate updates with a shared `media_group_id`. aiogram/grammy run them in parallel — a race:

```
handler 1: state.get_data()  →  empty
handler 2: state.get_data()  →  empty
handler 1: update_data({photos: [a]})
handler 2: update_data({photos: [b]})  — overwrote the first.
```

You get not "3 photos" but 1.

### 8.2. Solution: per-user lock

Lock per-user, not globally. Otherwise slow users block fast ones.

```python
import asyncio
_locks: dict[int, asyncio.Lock] = {}
def _get_lock(tg_id: int) -> asyncio.Lock:
    if tg_id not in _locks:
        _locks[tg_id] = asyncio.Lock()
    return _locks[tg_id]

@router.message(F.photo, SkinPhotoState.collecting)
async def handle(msg, state):
    async with _get_lock(msg.from_user.id):
        data = await state.get_data()
        photos = data.get("photos", [])
        photos.append(msg.photo[-1].file_id)
        await state.update_data(photos=photos)
```

### 8.3. Edit-in-place instead of spamming ack messages

The user sends 5 photos — they don't want to see 5 "Analyzing product…" messages. At the end: `edit_message_text("✓ Done · N analyses")`.

```python
async with _get_lock(tg_id):
    data = await state.get_data()
    ack_id = data.get("ack_msg_id")
    if ack_id is None:
        m = await msg.answer("Analyzing product 1...")
        await state.update_data(ack_msg_id=m.message_id, processed_count=1)
    else:
        count = data.get("processed_count", 0) + 1
        await bot.edit_message_text(
            f"Analyzing product {count}...",
            chat_id=msg.chat.id, message_id=ack_id,
        )
        await state.update_data(processed_count=count)
```

---

## 9. Sharing files and photos

### 9.1. Don't save photos to disk

Keeping a copy in `/uploads/` means:

- extra disk,
- an extra place to leak from,
- encryption headaches.

Use Telegram's `file_id`:

- The bot got a photo — save `msg.photo[-1].file_id` (a short string).
- Download via `getFile` + `/file/bot{token}/{path}`.
- Telegram keeps the photo itself indefinitely (within the bot's scope).

### 9.2. Sharing between the bot and the backend

**Option 1 (dev, one machine)** — a JSON file at an absolute path:

```python
photos_file = Path("/abs/path/data/skin_photos.json")
data = json.loads(photos_file.read_text()) if photos_file.exists() else {}
data[str(tg_id)] = file_ids
photos_file.write_text(json.dumps(data))
```

**Option 2 (prod)** — an internal POST with `X-Internal-Token`:

```python
await httpx.post(f"{BACKEND_URL}/internal/store_photos",
                 headers={"X-Internal-Token": PUSH_TOKEN}, ...)
```

### 9.3. Serve a photo to the mini app as `<img src>`

The mini app can't pull from the Telegram CDN directly (the token is there). The backend is the proxy:

```python
@router.get("/skin/photo/{idx}")
async def serve_photo(idx, request):
    init_data = validate(request.query_params["initData"])
    file_ids = load_photos_map()[str(init_data.user.id)]
    if idx >= len(file_ids):
        raise HTTPException(404)
    async with httpx.AsyncClient() as c:
        r = await c.get(f"https://api.telegram.org/bot{TOKEN}/getFile",
                        params={"file_id": file_ids[idx]})
        path = r.json()["result"]["file_path"]
        rr = await c.get(f"https://api.telegram.org/file/bot{TOKEN}/{path}")
    return Response(rr.content, media_type="image/jpeg",
                    headers={"Cache-Control": "private, max-age=3600"})
```

In the mini app: `<img src={`/api/skin/photo/${idx}?initData=${encodeURIComponent(raw)}`} />`. `initData` must be in the query — `<img>` doesn't send a body.

### 9.4. Encrypting sensitive content

If you store messages / private texts — encrypt with a symmetric key before writing to the DB. Decryption is only possible with the key in env. Critical for privacy-focused products.

```python
from cryptography.fernet import Fernet
fernet = Fernet(ENCRYPTION_SECRET.encode())
encrypted = fernet.encrypt(text.encode())
db.save({"user_id": user_id, "content": encrypted})
```

---

## 10. Payments: Stars vs Cards, Tribute, multi-currency

### 10.1. Stars (XTR) vs Cards

| Metric | Stars | Cards (via Tribute / another provider) |
|---|---|---|
| Auto-renew | NO — the main problem | YES |
| UX | Native `WebApp.openInvoice` — 1 tap | Deep link → Tribute Mini App → pick a card |
| Currencies | XTR only | RUB / EUR / USD |
| Availability | All users | Not all cards work (sanctions, local rules) |

Stars are nicer in UX, but without auto-renew the subscription economy falls apart. **Strategy:** show Stars as the first choice for one-off payments and trials; after payment — a push "connect a card → +N free days + 30% discount" (Star → Card upgrade).

### 10.2. Tribute Shop API — specifics

- Supports only `rub` / `eur` / `usd`. UAH, KZT, BYN, TJS, UZS, TRY, INR are NOT accepted (`error_invalid_currency`).
- Minimum — 10,000 in smallest units (= 100 RUB / 100¢ / 100¢).
- `period`: `onetime` / `weekly` / `monthly` / `quarterly` / `halfyearly` / `yearly`.
- Auto-renew works but requires the flag `shop.recurrent: true` in the Tribute dashboard.
- `paymentUrl` (web) vs `webappPaymentUrl` (Telegram deep link `t.me/tribute/app?startapp=shop_pay_<uuid>`) — for the mini app use the second so the user doesn't get kicked out of Telegram.
- Don't hardcode URLs from the Tribute UI dashboard. Generate an order per tariff via the API → the user won't see a picker inside Tribute, payment goes straight to the right amount.

### 10.3. Multi-currency: Display vs Charge

The user sees prices in their local currency (UAH, KZT, BYN, INR, USD, EUR, RUB). But the payment is always in rub/eur/usd. This is display vs charge currency.

- **Display** — what's in the UI.
- **Charge** — what's in the invoice.
- **Rate** — via the CDN `fawazahmed0/currency-api` on jsdelivr, no key, cache 24h in localStorage.
- After conversion — snap to a "nice" 9/99/999 price from a curated list.

Under the pay button, in small print, a disclosure:

```
Charge ≈ $4 · today's rate: $1 ≈ ₴41
```

The user sees the real price AND the actual charge. No surprises.

In the order comment, stamp: `"≈ 169 UAH @ 1 USD = 41 UAH | tariff=monthly lang=uk"` — for auditing discrepancies.

### 10.4. Special rule: the Ukrainian user

Never show RUB to a Ukrainian user. Even if they switched the interface to Russian. If you ever caught a Ukrainian trace (by `language_code`, IP geo, `selected_currency`) — mark a localStorage flag and always show USD instead of RUB.

This is a critical UX story — a Ukrainian user with ruble prices loses trust instantly. Once they see RUB → gone forever.

### 10.5. Card-on-file trial (a strong new pattern)

Since November 2025, Tribute supports a trial subscription — 1h / 12h / 24h / 3d / 7d. The user attaches a card, gets X free days, after which the tariff automatically becomes paid.

In marketing, don't call it a "trial period", only a "gift":

> Take 7 days free — attach a card.

This qualitatively changes the funnel: instead of "trial of 5 messages → ask to buy" — "attached a card → 7 days of use → auto-charge for everyone who didn't cancel".

A pre-warning push is mandatory 24h and 2h before the trial ends — otherwise the user forgets, gets charged, and leaves a negative review.

### 10.6. Subscriptions array — single source of truth

All tariffs in one structure in `utils/constants.ts` (or `config/pricing.ts`). Not scattered across handlers.

```ts
export const TARIFFS = [
  { id: 'weekly',   period: 'weekly',  prices: { rub: 149,  usd: 1.99,  eur: 1.99  }},
  { id: 'monthly',  period: 'monthly', prices: { rub: 299,  usd: 3.99,  eur: 3.99  }},
  { id: 'yearly',   period: 'yearly',  prices: { rub: 1499, usd: 19.99, eur: 19.99 }},
];
```

Subscription activation — a single method `subscriptionService.activateSubscription()` that:

1. Records the `Activate Tariff` event.
2. Creates a subscription record in the DB.
3. Updates `user.subscription`.
4. If `is_paid` — sends conversion events (Mixpanel, Propeller Ads, etc.).

Expiry — a cron `checkUsersSubscription` every N minutes walks subscriptions where `end_date < now()` → calls `endSubscriptionToUser` → writes an `End Subscription` event with a `tariff` field (distinguishes trial-ended vs paid-churn — critical for analytics).

---

## 11. Welcome, tone, texts

### 11.1. Communication tone (the main thing)

- **Talk like a human, not a corporation.** "If you're tired of X" — not "Activate your subscription…".
- **Specifics everywhere.** "Ivan deleted it at 14:23" beats "You have deleted messages".
- **Honesty about limitations reduces fear.** "This option is on the premium tier" builds trust, not rejection.
- **Self-aware irony is allowed.** "Cool, right? (no.)" reads more alive than smooth tone.
- **Opt-out as an option in the text.** "If you don't need it — delete it" paradoxically retains.
- **Emoji — functional only** (arrows, statuses, ✓ ✗). From the product's voice — no.
- **Button = action verb.** "Restore" beats "Check" or "Details".
- **Don't call the product a "bot"** — the word carries spam-bot connotations. "Tool", "app", "extension".
- **Error texts shouldn't sound sad from the product's voice.**

### 11.2. Welcome doesn't sell — it removes fear

- The first message doesn't sell. First it removes fear and explains what's happening.
- The main fear is security. Address it explicitly, not by hints: "Works via the official Telegram Business API. Only sees the chats you enabled yourself. Messages are encrypted."
- Show 2-3 key differences from competitors right away. "Works on iOS" beats "the best solution".
- Minimum steps to the first "wow". 5 minutes from signup to a visible result.
- Welcome explains the value in one sentence: "If someone deleted a message — this tool restores it" beats "Advanced capabilities for smart people".
- A good welcome is concrete and without fluff, without the word "AI": "I analyze X for your Y: I find conflicts, warn about errors, help you assemble a working result." Replace X/Y with your product's vertical.

---

## 12. Funnel and events

### 12.1. Canonical stages (a typical funnel)

| Stage | Mixpanel event | What in Telegram | Typical conversion |
|---|---|---|---|
| 1. Start | `Sign Up` | user tapped /start, bot saved to DB | 100% |
| 2. Welcome | `welcome_sent` | bot sent the welcome | ~100% |
| 3. Open MiniApp | `Open MiniApp` | user tapped to open the app | ~54% |
| 4. Setup | `Set Up Bot` | user did the key onboarding action | ~43% |
| 5. First trigger | `Got the message` | a real event for the user | ~15-30% |
| 6. Tap CTA | `Check Message` | user tapped the main button | 4% of signup |
| 7. Paywall view | `paywall_viewed` | landed on the paywall | ~3% |
| 8. Pay click | `pay_clicked` | picked a tariff and tapped pay | ~1% |
| 9. Purchase | `Purchase` + `Activate Tariff` | payment went through | ~0.6-1.8% |

### 12.2. Where people drop off — the typical picture

- **Sign Up → Setup: 50-60% drop** — the main cause is fear / confusion. Mitigation: welcome with a safety block + per-platform guides (iOS/Android).
- **Setup → First Trigger: 50-65% drop** — this is not a technical drop, but the absence of a real event for the user. Solution — anti-zombie mechanics: don't push activation in this phase, wait for the event.
- **Trigger → Tap CTA: 85% drop** — notification CTR is only ~4%. This is the biggest lost revenue. Raising CTR from 4% to 10% is a multiplied revenue growth. Mitigation: a "fake demo" push beforehand so the user EXPECTS this format; and a micro-funnel with minimal steps to payment.
- **Tap CTA → Purchase: 75% make it** — the best step in the whole funnel. Here the problem isn't conversion, it's the volume of entry.

**The main practical rule:** optimize CTR on the inline notification, not on the paywall.

---

## 13. Push philosophy

### 13.1. "Nuclear pushes" — the job is to put the question on edge

Your job is to get to the moment where the question becomes binary as fast as possible:

- EITHER the person blocks you and forgets,
- OR they go and take the action.

If you don't push them to the point of blocking — you're not pushing them to purchase either. Grey is the worst.

In practice:

- **Grey "didn't buy, didn't block" is the worst.** The user sits in the DB, brings nothing, occupies the push audience.
- **Black-and-white "bought OR blocked" is preferable.**
- **Don't fear blocks as a metric.** A high block rate is healthy if purchase conversion grows.

### 13.2. User types and their strategies

| Type | Description | Strategy |
|---|---|---|
| 1. Ideal | /start → set up → paid → left | Minimum pushes. Only pre-expiry warnings. |
| 2. Signed up, didn't set up | dead silent | Fake demo at 24-48h ("mom deleted a message…") to show WHAT they'll receive. |
| 3. Set up, didn't pay | trial / freeloader | Contextual pushes Mon/Fri ("over the weekend N were deleted"). Don't offer tariffs — offer a concrete action. |
| 4. Paid with Stars, didn't renew | the critical hole | Star → Card upgrade push. Pre-expiry warning. These users already paid, ready to pay. |

### 13.3. Contextual timing beats frequency

The main signal of high CTR is a push that coincides with a real event for the user. Not "try a subscription" on schedule, but "your contact just deleted a message".

The right push architecture is not cron, but event-driven: catch a business webhook on a trigger-event for a user without a subscription → send a contextual push at that moment.

This mechanic is called **anti-zombie** — don't push into the void, wait for a real signal.

### 13.4. Principles for concrete texts

- A concrete name (Ivan, Maria, mom, dad) is stronger than the impersonal "contact".
- A concrete time ("at 14:23") is stronger than "recently".
- A concrete number ("over the weekend, 7 messages were deleted") is stronger than "you have deleted messages".
- Cutting off with "…" baits the open. "I have bad new…" is stronger than a finished thought.
- Caps for the trigger: "RESTORE RIGHT NOW" — acceptable in the moment of a hot event.

### 13.5. Micro-funnel from trigger to payment

You need immediately: "Ivan Ivanov deleted a message. Restore right now?". Button "Yes". Cap-locked only: this person — restore!

This is the opposite of the standard "You have deleted messages. Go to the Mini App to see tariffs." — between the trigger and payment there must be no extra screens: no "subscription ended", no "pick a tariff", no "invite a friend".

---

## 14. Analytics

### 14.1. Tracking principles

- **The event is written BEFORE the action, not after.** If the action fails (network error, rate limit) — the event must still fire. `welcome_sent` was written AFTER `sendPhoto` → when the photo failed, no record happened → Mixpanel numbers understated by 30%. Fix: write the event BEFORE the side-effect + a separate event for failures (`welcome_send_failed`).
- **Full coverage on every user action.** Tap → event. Open → event. Submit → event. Without this there are blind zones in the funnel.
- **One `distinct_id` in the bot and the mini app** (see chapter 3).
- **Properties as separators.** Don't spawn separate `Sign Up RU` / `Sign Up UA` events — one `Sign Up` with a property `bot_tag: "main"|"ua"`.

### 14.2. Key events — the canonical set

- **Bot:** `Sign Up`, `welcome_sent`, `welcome_send_failed`, `Set Up Bot`, `Got the message`, `Check Message`, `Click /premium`, `Click /referrals`, `Push Received` (with `received: true/false`), `Push Click`, `Activate Tariff` (with `tariff`, `price`, `payment_type`), `Purchase`, `End Subscription` (with `tariff` — distinguishes trial-ended from paid-churn).
- **Mini App:** `Open MiniApp`, `app_session_started`, `app_session_ended`, `app_*_clicked` (per feature), `app_paywall_viewed`, `app_setup_video_played`, `app_open_settings_cta_clicked`, `app_copy_username`.

### 14.3. Ground rules for cohort splits

Before any group comparison — four mandatory gates:

1. **Team filter** — exclude the team's telegram_ids. Their activity is testing, not signal.
2. **Setup gate** — only consider those who did `Set Up Bot`. Before setup there's no engagement.
3. **Exposure gate** — only consider those who had ≥1 `Got the message` (or another trigger-event). Without a real event the user simply never saw the product. They didn't drop off — nothing happened for them.
4. **Window gate** — the observation window must be the same across the compared cohorts. Fresh users over 7 days vs old ones over 30 is invalid. Normalize to T-days from signup.

The trigger thought "but they didn't even set it up…" during analysis = a missed gate. Apply the gates without reminders.

---

## 15. Trial and paywall

### 15.1. Time-based, not count-based

- A count-based trial without an expiry date → the user gets stuck in the free zone forever. "You have 5 messages" — they hoard them, don't use them, don't convert.
- A time-based trial creates a decision point. "You have 7 days left" works; "you have 5 messages left if there are events" — doesn't.

### 15.2. Trial = a binary moment at the end

When the trial ends — you need a clear "buy OR delete". A grey middle state = freeloader forever.

Don't grant a second trial automatically. If the user didn't buy after the first — that's a signal, not an excuse for a second. A typical mistake: an automatic "TRIAL2" of ~5 content units after the first trial. In practice this gives hundreds of freeloaders/month and tens of thousands of rubles in lost revenue/month.

### 15.3. No "N free out of M" in texts

Counter-intuitive but true. If every message says "2 free analyses left out of 3":

- The user feels pressure from the first touch.
- "Free" makes them look for "paid" — they leave before they feel the value.
- On the third analysis the paywall appears — for the user this is a surprise and a deception ("I thought it was all free").

The right way: just give value 3 times. On the fourth — a quiet paywall: "Want to continue? Pick a plan".

### 15.4. Sticky CTA at the bottom

On the payment screen keep the "Pay" button pinned to the bottom via `position: fixed`. The tariff list scrolls above it.

```css
.sticky-cta {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    padding: 16px;
    background: white;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.04);
}
```

Don't forget `padding-bottom: 80px` on the list container, otherwise the button covers the last tariff.

### 15.5. Preview before tariffs

Never show tariffs first. First a preview of the result — feature list, an example screenshot, "here's what you get". Below — a "Get it" button; on tap — the screen with tariffs.

A two-step screen turns the paywall into "you chose to peek yourself" instead of "you got hit with a paid wall".

---

## 16. Mini app UX: native Telegram elements

Ignoring native widgets means losing UX.

**If you build the mini app with React — use the `@tma.js/sdk-react` library alongside it** (the current Telegram Mini Apps SDK for React). It gives typed, reactive wrappers and hooks around the native widgets this chapter covers — BackButton, viewport/`expand`, theme params, safe-area insets, main button — instead of poking `window.Telegram.WebApp` by hand. Cleaner lifecycle and fewer "called too early / undefined" bugs.

### 16.1. BackButton

Telegram gives a built-in "back" in the top panel. This is not the browser's "back" — it's your API.

Don't put your own "Back" button inside the interface. Telegram already gives one — yours will visually duplicate and break the mental model.

Use a `BACK_MAP` (an object `from → to`) for the chain. On the root screen — `BackButton.hide()`.

```js
const tg = window.Telegram?.WebApp;
tg?.BackButton?.show();
tg?.BackButton?.onClick(() => { /* your navigation */ });
tg?.BackButton?.hide();
```

### 16.2. Header and background

Call on every mount. If you change dark/light theme per screen — change this too.

```js
tg.setHeaderColor('#F4EFE6');     // match the mini app's background
tg.setBackgroundColor('#F4EFE6');
```

### 16.3. Full height

Call once on init. Otherwise the mini app opens at ~80% height, the user sees the chat below, pulls down — and closes the window.

```js
tg.expand();
```

### 16.4. Scroll to top on screen change

In an SPA this doesn't fire on its own.

```js
useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
}, [screen]);
```

### 16.5. Safe-area under the iOS notch

Minimum 80px on top, better 120px+ for the iOS notch. Otherwise the mini app's header slides under the Telegram chrome.

```css
.app-root {
    padding-top: calc(env(safe-area-inset-top, 0px) + 120px);
}
```

### 16.6. iOS auto-zoom

iOS auto-zooms an input if `font-size < 16px`. This breaks the mini app layout. Always `font-size: 16px` (or more) on input/textarea/select.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
```

### 16.7. Skeleton structurally identical to the layout

Not grey rectangles — a copy of the future DOM structure. Otherwise everything jumps on load. The user sees "how it will be" from the first millisecond.

### 16.8. tg-spoiler as a psychological hook

For gated content (paywall, premium features) — `<span class="tg-spoiler">text</span>` is stronger than a grey lock-overlay. The user physically sees the blur and wants to tap.

---

## 17. Navigation in the mini app

### 17.1. One screen-router, not react-router

For a mini app, `react-router` is overkill. You have 8-15 screens, navigation is linear or with return.

This gives:

- Cheap `BackButton` via `BACK_MAP[screen]`.
- Simple reset — `setScreen('profile')`.
- No syncing with `window.history`, which behaves weirdly in a WebView.

```ts
type Screen = 'profile' | 'quiz' | 'result' | 'pricing' | ...;
const [screen, setScreen] = useState<Screen>('profile');
```

### 17.2. Query params as single-shot triggers

The bot can open the mini app with a hint of "where to start":

```
https://your-app/?screen=quiz&photos=1
```

The mini app reads it once on mount and clears the URL:

```ts
useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('screen');
    if (target) setScreen(target as Screen);
    window.history.replaceState({}, '', '/');
}, []);
```

Without `replaceState` the user closes the mini app, opens it again — and gets thrown to the same screen again.

### 17.3. Deep links

Format: `https://t.me/{bot_username}/{app_short_name}?startapp={payload}`. Without `startapp` — opens on the main screen.

With `startapp=onboarding` — the mini app reads `Telegram.WebApp.initDataUnsafe.start_param`. Use for:

- Invitations (referral code).
- Return after payment.
- Launching a target flow from an inline button (e.g. restore, continue a conversation, open a separate action).

---

## 18. Photo flow and media

### 18.1. Step 1 — collect in the chat, step 2 — action in the mini app

The user physically can't comfortably take photos through a WebView. The iOS camera in a WebView returns a compressed image without EXIF; on Android — bugs across different webviews.

Solution: the user sends photos to the bot in the chat (native camera UI). Then with one button they move to the mini app, where they already see the photos and interact with the result.

### 18.2. Don't allow uploading from the device in the mini app

The temptation is to add `<input type="file" accept="image/*">`. Don't. Problems appear immediately:

- EXIF compression (especially iOS).
- File size (uploading 4 MB over 4G — ~10 seconds).
- Upload authorization.

Telegram already solved these problems. Use it.

### 18.3. Preview in the mini app via a proxy

Don't give the mini app "a link to the Telegram CDN" (the token is there). Give a proxy URL like `/api/photo/{idx}?initData=...`. The backend downloads and streams. `Cache-Control: private, max-age=3600` — otherwise every screen mount re-downloads.

---

## 19. Gamification and social elements

### 19.1. Streak — not a number, but a grid

"You're on a 7-day streak" — dead text. A grid of 14 dots, where green = done, grey = not — a living object; the user wants to "not break it".

```js
const days = JSON.parse(localStorage.getItem('streak_days') || '[]');
const grid = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return days.includes(d.toISOString().slice(0, 10));
});
```

### 19.2. Leaderboard without numbers — with stories

Not "Masha has 27 analyses, you have 4". That hits self-esteem. Show:

- Name, avatar.
- Streak.
- What they use (brands, product types) — without frequencies.
- IG/TG links if the user added them.

The board becomes a source of inspiration, not a reproach.

### 19.3. Reward rare actions

A basic action ("opened the app") can't be rewarded — that's inflation and spam. Reward:

- The first complete routine.
- A 7-day streak.
- The first analysis / restore / scan.

Rare pushes via the bot: "This week you analyzed 3 products — strong. Want to compare with the community?"

---

## 20. Reset and debug

Support a `/reset` command in the bot. It must:

1. `await state.clear()` — reset the FSM.
2. Delete the record from the JSON sharing files.
3. `DELETE FROM users WHERE tg_id = $1` (cascade related).
4. Delete in-memory profiles.
5. Reply with a "Open a clean mini app" button with a URL `?reset=1`.

In the mini app `?reset=1` → `localStorage.clear()` → `window.location.replace('/')`.

It saves you during debugging. It proves to regulators that data is deleted (GDPR).

---

## 21. Localization

### 21.1. Not separate events, but a property

`Sign Up RU` + `Sign Up UA` = wrong. One `Sign Up` with `language_code: 'ru' | 'uk' | 'en'`.

### 21.2. Language from Telegram + override in the mini app

```ts
const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
const stored = localStorage.getItem('lang');
const lang = stored || tgLang || 'en';
const t = (key: string) => i18n[lang][key] ?? i18n['en'][key] ?? key;
```

### 21.3. Texts in an i18n structure, not in code

Pushes in the bot — the same, a separate module with 14+ locales.

---

## 22. Antipatterns

- ❌ Storing photos on disk instead of Telegram's `file_id`.
- ❌ A global `asyncio.Lock` across all users.
- ❌ `react-router` for 10 mini-app screens.
- ❌ A "Back" inside the interface when `BackButton` is available.
- ❌ `sendData` when opening the mini app from a menu button.
- ❌ AI keys / payment keys in the frontend.
- ❌ JSON files as sharing across different machines.
- ❌ MemoryStorage for the FSM in a payment flow on prod.
- ❌ "N free out of M" in every message.
- ❌ An "Upload photo" button in the mini app instead of collecting via the bot.
- ❌ No `/reset` — half of debug sessions hit someone else's state.
- ❌ A cron-only push strategy without an event-driven layer.
- ❌ Identity merge via the Mixpanel UI instead of one `distinct_id` from the first event.
- ❌ RUB prices to Ukrainian users.
- ❌ A count-based trial without an expiry.
- ❌ An automatic second trial.
- ❌ A TTL on initData.
- ❌ Hardcoding the payment URL from the payment system dashboard.
- ❌ `react-router` synced with `window.history` in a WebView.
- ❌ `font-size < 16px` on inputs in an iOS WebView.
- ❌ Grey-square skeletons instead of a structural skeleton.

---

## 23. Checklist: a "minimum viable" Telegram stack

**Architecture**
- Bot, Backend, Mini App — three separate processes.
- `BOT_TOKEN` matches in the bot and the backend.
- `PUSH_INTERNAL_TOKEN` differs from external keys.
- AI keys only in the backend.
- `ENCRYPTION_SECRET` if sensitive content is stored.

**Identity**
- One `distinct_id = telegram_user_id` across all analytics events.
- Mixpanel `identify()` in the bot on `Sign Up`.
- Mixpanel `identify()` in the mini app on `App.tsx` mount.

**Security**
- All requests from the mini app → HMAC initData.
- All internal requests → `X-Internal-Token`.
- `file_id` not exposed to the mini app — only indices and a proxy.

**Races**
- Per-user `Lock` for media groups.
- Edit-in-place for batch acknowledge.
- Idempotent intent endpoints.

**UX nativeness**
- `tg.expand()` on start.
- `tg.setHeaderColor()` and `setBackgroundColor()` matching the background.
- Native `BackButton` with `BACK_MAP`.
- `scrollTo(0)` on screen change.
- `padding-top` with safe-area.
- `font-size: 16px` on inputs.
- Structurally identical skeleton.

**Payments**
- Stars + Cards both available.
- Tribute / other provider: `webappPaymentUrl`, not web.
- Display vs Charge currency with a disclosure under the button.
- Ukrainians — never RUB.
- Card-on-file trial as a "gift".
- Pre-expiry warning push (24h + 2h).
- Star → Card upgrade push after a Stars payment.

**Welcome and texts**
- Welcome removes fear, doesn't sell.
- Buttons = action verbs.
- Don't call the product a "bot" in texts.
- No "N free out of M" in routine messages.

**Push philosophy**
- Event-driven, not cron-only.
- Contextual pushes (on a real event).
- Anti-zombie — don't push before Setup and before the first triggering event.
- Concrete names, times, numbers in texts.
- Pre-expiry warnings are mandatory.

**Analytics**
- The event is written BEFORE the side-effect.
- Separate `_failed` events for failures.
- All 4 cohort gates applied in analysis.
- `End Subscription` distinguishes trial-ended from paid-churn via `tariff`.

**Trial and paywall**
- Time-based, not count-based.
- No automatic second trial.
- A preview screen before the tariff list.
- Sticky CTA at the bottom.
- Micro-funnel ≤ 2 taps from trigger to payment.

**Localization**
- Texts in an i18n structure.
- One event + property, not separate events per language.
- Language override in localStorage.

**Debug**
- `/reset` clears FSM + DB + JSON + memory.
- `?reset=1` clears localStorage in the mini app.

**Deploy**
- HTTPS mandatory (Telegram WebApp doesn't allow HTTP).
- Mini App on a CDN / Vercel.
- Structured logs.
- Long polling for MVP, webhook for prod.

---

## 24. Golden rules (one screen)

1. **One identity.** `distinct_id = telegram_user_id` everywhere.
2. **Analytics BEFORE the action.** `trackEvent` as the first line of the handler.
3. **Gates before cohorts.** team / setup / exposure / window — without them any split is a lie.
4. **Welcome removes fear, doesn't sell.** The safety argument first.
5. **Minimum steps from trigger to payment.** 1 click ideal, 2 max.
6. **Contextual push >> cron push.** Wait for a real event, not a timer.
7. **Engagement → conversion, not the number of pushes.** Focus on real trigger-events.
8. **Trial = decision point.** Time-based, not count-based. A hard end.
9. **Display ≠ Charge currency.** UI in the local one, invoice in rub/eur/usd. Ukrainians — never RUB.
10. **Card-on-file trial — the path to auto-renew without pain.** Disguise it as a "gift".
11. **tg-spoiler as a psychological hook.** The user physically sees the blur.
12. **Mini App ≠ corporate.** Human, concrete, self-aware tone.
13. **Intent-pattern instead of `sendData`.** Via the backend + `StorageKey`.
14. **Per-user Lock for media groups.** Edit-in-place for batch acknowledge.
15. **Native BackButton via `BACK_MAP`,** not your own UI.
16. **Telegram's `file_id` as the only media storage.**
17. **`tg.expand()` + `setHeaderColor`** on every mount.
18. **`/reset` + `?reset=1`** — a mandatory pair for debugging.
19. **AI keys only in the backend.** Never in the frontend.
20. **One source of truth for tariffs** — `constants.ts` with an array, not scattered across handlers.

---

## 25. Conclusion

The main principle you must not break:

> The user came to Telegram, not to your app.

Chat is the primary interface. The mini app is an extension. Any step outside (browser, email, SMS) costs 30-50% of conversion.

**Engagement → conversion.** Not pushes, not the paywall, not the markup. If a user has real activity of 100 events/week in their chats — they convert at 27.5%. If 1-5 events — at 4%. So the focus is always on creating a real triggering event for the maximum number of users.

One identity, analytics before the action, gates before cohorts, welcome removes fear, minimum steps to payment, contextual push, trial as a decision point, display ≠ charge currency, Ukrainians never RUB, card-on-file as a gift, tg-spoiler as a hook, a human tone.

This is the stack. Everything else is implementation detail.

_This document is a living reference. It grows as new rules appear and the backlog closes._
