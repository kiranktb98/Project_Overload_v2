# How to Use

This is the fastest way for a teammate to run the app locally exactly like your setup.

## 1) Pull latest code

```bash
git pull origin main
```

## 2) Create local env

- Copy your working `.env` values into their local `.env`.
- Do **not** commit `.env`.
- Required values must be set:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `WEB_API_BASE_URL`
  - `NEXT_PUBLIC_API_URL`
  - `OPENROUTER_API_KEY`
  - `APP_ENCRYPTION_KEY`
  - `SESSION_SECRET`
  - `LLM_PROVIDER=openrouter`

## 3) Start infra

```bash
docker compose -f infra/docker-compose.yml up -d
```

## 4) Install and run

```bash
pnpm i
pnpm dev
```

## 5) Open app

- Web UI: `http://localhost:3000`
- API health: `http://localhost:4000/health`

## 6) Basic troubleshooting

- If chat fails instantly:
  - Confirm API is running on `:4000`
  - Confirm `WEB_API_BASE_URL` and `NEXT_PUBLIC_API_URL` point to `http://localhost:4000`
  - Confirm `OPENROUTER_API_KEY` is present
- If DB actions fail:
  - Confirm Postgres/Redis are up in Docker
  - Confirm `DATABASE_URL` and `REDIS_URL` are reachable

