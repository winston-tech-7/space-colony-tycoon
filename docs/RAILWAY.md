# Деплой на Railway (без ПК)

Игра будет работать 24/7 на сервере Railway. Ngrok и локальный ПК не нужны.

## 1. Регистрация

1. [railway.app](https://railway.app) → Sign up (GitHub удобнее всего)
2. **New Project** → **Deploy from GitHub repo** (или **Empty Project** + CLI)

## 2. PostgreSQL

1. В проекте: **+ New** → **Database** → **PostgreSQL**
2. Railway сам создаст переменную `DATABASE_URL` для сервиса приложения

## 3. Сервис приложения

### Вариант A — GitHub (рекомендуется)

1. Залей репозиторий на GitHub (папка `space-colony-tycoon`)
2. Railway → **New** → **GitHub Repo** → выбери репозиторий
3. Root Directory: `space-colony-tycoon` (если репо — весь idle-clicker)

### Вариант B — CLI с ПК (один раз)

```cmd
cd space-colony-tycoon
npx @railway/cli login
npx @railway/cli init
npx @railway/cli add --database postgres
npx @railway/cli up
```

## 4. Публичный домен

1. Сервис приложения → **Settings** → **Networking**
2. **Generate Domain** → появится URL вида `https://xxx.up.railway.app`
3. Railway выставит `RAILWAY_PUBLIC_DOMAIN` — приложение подхватит его автоматически

## 5. Переменные окружения

**Variables** у сервиса приложения:

| Переменная | Значение |
|------------|----------|
| `BOT_TOKEN` | токен от @BotFather |
| `BOT_USERNAME` | `spacecolonyT_bot` |
| `WEBHOOK_SECRET` | случайная строка, напр. `winston7777` |
| `NODE_ENV` | `production` |
| `USE_POLLING` | `0` |
| `DATABASE_URL` | подключить из PostgreSQL (Reference) |

`WEBAPP_URL` можно не задавать — возьмётся из `RAILWAY_PUBLIC_DOMAIN`.

Опционально: `OPENAI_API_KEY`, `STARS_ENABLED=1`.

## 6. BotFather

После первого успешного деплоя:

1. Скопируй домен Railway: `https://xxx.up.railway.app`
2. @BotFather → `/mybots` → **Menu Button** → Web App URL
3. Вставь этот URL (без `/` в конце)

## 7. Проверка

```text
https://xxx.up.railway.app/health
```

Ответ: `{"ok":true,...}`

В Telegram: @spacecolonyT_bot → **🚀 Играть**

## Локальная разработка

На ПК по-прежнему:

```cmd
npm.cmd run stack:start
```

На Railway — отдельная среда, ПК можно выключать.

## Стоимость

- Railway даёт ~$5 кредитов в месяц на Free/Hobby
- PostgreSQL + один сервис обычно укладываются в trial; следи за **Usage** в дашборде
