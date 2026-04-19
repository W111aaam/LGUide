# LGUide Pomodoro API

Cloudflare Workers + D1 backend for the Pomodoro heatmap.

## Endpoints

- `GET /api/health`
- `POST /api/user`
- `POST /api/session`
- `GET /api/heatmap?user_id=...&year=2026`
- `GET /api/stats?user_id=...`

## Deploy

```bash
npx wrangler d1 create pomodoro-db
```

Copy the returned `database_id` into `wrangler.toml`, then initialize the remote database and deploy:

```bash
npx wrangler d1 execute pomodoro-db --remote --file=./schema.sql
npx wrangler deploy
```

Optional KV cache:

```bash
npx wrangler kv namespace create USER_CACHE
```

Copy the returned namespace ID into the commented `kv_namespaces` block in `wrangler.toml`.
