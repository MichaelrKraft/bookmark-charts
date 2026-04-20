# Bookmark Charts

> Your bookmarks are a time capsule of every version of yourself you abandoned. Drop your `bookmarks.html` and see the story.

![Bookmark Charts](site/bmcharts-logo.png)

**Try it free:** [bookmarkcharts.com](https://bookmarkcharts.com) · **Fork it:** [github.com/MichaelrKraft/bookmark-charts](https://github.com/MichaelrKraft/bookmark-charts)

100% client-side — your bookmarks never leave your browser. No account. No tracking. No server needed (for the tool itself).

Built in an afternoon with [Coder1](https://coder1.ai), the IDE for Claude Code.

---

## What it does

Drop a `bookmarks.html` exported from Chrome / Firefox / Safari / Arc / Brave / Edge, and get:

- **Your archetype** — one of 12 identity types assigned from your bookmark patterns (The AI Builder, The Productivity Hoarder, The Rabbit-Hole Archaeologist, etc.)
- **Timeline view** — month-by-month bookmark volume with category mix stacked across years
- **Force-directed graph** — your top 100 domains clustered by category, sized by frequency
- **Search + browse** — fast fuzzy search with thumbnails and live previews
- **Reveal cards** — the "read later" graveyard, your first bookmark with its date, peak year, vs-average stats
- **Share card** — auto-generated 1200×630 PNG for X, LinkedIn, or Instagram, with your archetype and stats

---

## Use it

### Hosted (easiest)

[bookmarkcharts.com](https://bookmarkcharts.com) — open, drop your file, done.

### Run locally (no install)

```bash
git clone https://github.com/MichaelrKraft/bookmark-charts.git
cd bookmark-charts/site
python3 -m http.server 8000
# open http://localhost:8000
```

Or just download `site/app.html` and open it directly in a browser. It's a single HTML file with no build step.

### Self-host (your own domain)

Any static host works: GitHub Pages, Netlify, Vercel, Cloudflare Pages, Render static site. Just point it at `site/` as the publish directory.

---

## How to export your bookmarks

| Browser | Steps |
|---|---|
| **Chrome / Brave / Edge** | `chrome://bookmarks` → ⋮ → Export bookmarks |
| **Firefox** | Ctrl+Shift+O → Import and Backup → Export Bookmarks to HTML |
| **Safari** | File → Export → Bookmarks |
| **Arc** | Arc menu → Archive → Export Bookmarks |

---

## Repo structure

```
site/               The static tool + landing page (this is the whole product)
  index.html        Landing page
  app.html          The tool — upload, parse, analyze, share
  bmcharts-logo.png Logo

api/                Optional Node/Express service for lead capture (see below)
  server.js         POST /capture → email via Resend + append to JSONL
  package.json

render.yaml         Blueprint for hosting on Render (static site + optional API)
```

---

## Customize / Fork

The tool is one HTML file with embedded JS. To customize your own fork:

- **Archetypes** — edit the `ARCHETYPES` array in `site/app.html`. Each has an id, a name, a `signal` function that takes category percentages, and a description. Order matters — first matching archetype wins.
- **Category rules** — edit `CATEGORY_RULES` in `site/app.html`. Each rule is `[categoryName, [domains], [keywords]]`. Matches check domain exact/suffix/substring then keyword substring.
- **Colors** — `CATEGORY_COLORS` in `site/app.html`.
- **Branding** — replace `bmcharts-logo.png` with yours (same location, any size), update `<title>` and meta tags.

---

## Optional: lead capture (for SaaS / marketing use)

If you want email capture (like for a lead magnet), the `api/` folder has a small Express server that handles form POSTs. Four ways to wire that up:

| Option | Cost | Setup |
|---|---|---|
| **Formspree / Web3Forms** | Free tier (50–250/mo) | Zero code — change the form `action` to their URL |
| **Render Free web service** | Free | Uses `render.yaml` as-is. Service spins down after 15 min, first request cold-starts (~30s) |
| **Render Starter** | $7/mo | Always-on, no cold starts |
| **Cloudflare Workers** | Free (100k req/day) | Rewrite `server.js` as a Worker |

### Running the Node service locally

```bash
cd api
npm install
RESEND_API_KEY=re_xxx NOTIFY_EMAIL=you@example.com npm run dev
# listening on :8766
```

The tool auto-detects the API base: `localhost` → `http://localhost:8766`, else `https://bookmark-charts-api.onrender.com` (edit `site/app.html` → `API_BASE` for your own domain).

### API env vars

| var | purpose |
|---|---|
| `RESEND_API_KEY` | Required for outbound notification emails to `NOTIFY_EMAIL` |
| `NOTIFY_EMAIL` | Where new-lead emails are sent |
| `FROM_EMAIL` | From header (must be a verified Resend sender) |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist |
| `ADMIN_KEY` | Secret to GET `/leads?key=…` for export |
| `LEADSPOT_URL` | Optional — forward captures to a LeadSpot-compatible endpoint |
| `LEADSPOT_KEY` | Optional — API key for `LEADSPOT_URL` |

### Export leads to CSV

```bash
curl -s "https://YOUR-API.onrender.com/leads?key=$ADMIN_KEY" \
  | jq -r '.leads[] | [.ts, .email, .archetype, .total, .top_category] | @csv'
```

---

## Tech

- One static HTML file, zero build step
- [D3.js v7](https://d3js.org/) for charts + force-directed graph (loaded from CDN)
- Native browser DOMParser for bookmarks.html parsing
- Canvas 2D for share card generation
- Optional Express + CORS for lead capture backend

---

## Privacy

The tool is a static HTML file. When you drop your bookmarks in, parsing happens in your browser's memory. Nothing is POSTed, logged, or saved. Open DevTools → Network tab while you use it — there are zero outbound requests to the tool's own origin.

The only optional network activity is the email capture form (if you choose to submit), and favicon lookups to `google.com/s2/favicons` for the browse thumbnails.

---

## Built with

This tool was built in one afternoon using [Coder1](https://coder1.ai) — an agentic IDE for Claude Code. If you want to build lead magnets, internal tools, or whole micro-SaaS products this fast, that's the fastest path.

---

## License

MIT — fork it, change it, rebrand it, ship it.

If you launch a variant, I'd love to see it. [@mikedropmk](https://twitter.com/mikedropmk)
