# Bookmark Charts

Drop your `bookmarks.html` → get a data-story of who you've been trying to become.

Lead magnet for [Coder1](https://coder1.ai). 100% client-side parsing — nothing uploaded.

## Structure

```
site/          Static site (deployed to Render as a static service)
  index.html     Landing page
  app.html       The tool — upload, parse, analyze, share
api/             Tiny Node/Express lead-capture service
  server.js      POST /capture endpoint
  package.json
render.yaml      Render blueprint (1 static site + 1 web service)
```

## Local dev

```bash
# Tool + landing (serve site/ statically)
cd site && python3 -m http.server 8765
# open http://localhost:8765/

# API (optional — lead capture)
cd api
npm install
RESEND_API_KEY=re_xxx NOTIFY_EMAIL=support@callspot.ai npm run dev
# listening on :8766
```

The tool checks `location.hostname` to pick the API base — `localhost` → `http://localhost:8766`, otherwise `https://bookmark-charts-api.onrender.com`.

## Deploy

1. Push this repo to GitHub.
2. On Render: New → Blueprint → point at this repo.
3. Fill in the marked env vars (`sync: false`): `RESEND_API_KEY`, `ADMIN_KEY`, and optionally `LEADSPOT_URL` / `LEADSPOT_KEY`.
4. Render creates both the static site and the API service from `render.yaml`.

## Env vars (API)

| var | purpose |
|---|---|
| `RESEND_API_KEY` | For outbound lead notification emails to NOTIFY_EMAIL |
| `NOTIFY_EMAIL` | Where new-lead emails go (default: support@callspot.ai) |
| `FROM_EMAIL` | From header (must be a verified Resend sender) |
| `ALLOWED_ORIGINS` | CSV of allowed CORS origins |
| `ADMIN_KEY` | Secret to read `/leads?key=...` |
| `LEADSPOT_URL` | Optional — future LeadSpot public capture endpoint |
| `LEADSPOT_KEY` | Optional — API key for that endpoint |

## What the API stores

Every lead appends one JSON line to `api/data/leads.jsonl`:

```json
{"ts":"2026-04-20T17:00:00.000Z","email":"x@y.com","archetype":"The AI Builder","total":3421,"top_category":"AI","utm":{"utm_source":"twitter"},"ip":"...","user_agent":"..."}
```

Export to CSV for LeadSpot import:

```bash
curl -s "https://bookmark-charts-api.onrender.com/leads?key=$ADMIN_KEY" | jq -r '.leads[] | [.ts, .email, .archetype, .total, .top_category] | @csv'
```

## Lead routes (current vs planned)

- **Now:** static site → `/capture` on Render web service → email via Resend + append to JSONL.
- **Next:** when LeadSpot backend is publicly deployed with a public lead-capture endpoint, set `LEADSPOT_URL` and `LEADSPOT_KEY` — captures auto-forward.

## License

MIT
