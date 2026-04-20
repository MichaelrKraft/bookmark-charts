import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');
const PORT = process.env.PORT || 8766;

const RESEND_KEY = process.env.RESEND_API_KEY;
const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'support@callspot.ai';
const FROM = process.env.FROM_EMAIL || 'Bookmark Charts <noreply@coder1.dev>';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:8765,http://localhost:3000,http://127.0.0.1:8765,https://bookmark-charts.onrender.com'
).split(',').map(s => s.trim());

const LEADSPOT_URL = process.env.LEADSPOT_URL;
const LEADSPOT_KEY = process.env.LEADSPOT_KEY;

await fs.mkdir(DATA_DIR, { recursive: true });

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    if (origin.endsWith('.onrender.com') || origin.endsWith('.coder1.ai')) return cb(null, true);
    cb(new Error('Origin not allowed: ' + origin));
  }
}));
app.use(express.json({ limit: '50kb' }));

// Rate limit: simple in-memory per-IP (drop-in for MVP; swap for Redis later)
const bucket = new Map();
function rateLimit(ip, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const rec = bucket.get(ip) || { hits: [], };
  rec.hits = rec.hits.filter(t => now - t < windowMs);
  if (rec.hits.length >= max) return false;
  rec.hits.push(now);
  bucket.set(ip, rec);
  return true;
}

app.get('/', (req, res) => res.json({ ok: true, service: 'bookmark-charts-api' }));
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.post('/capture', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  if (!rateLimit(ip)) return res.status(429).json({ error: 'Too many requests' });

  const { email, archetype, total, top_category, source, utm } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const lead = {
    ts: new Date().toISOString(),
    ip,
    email: email.trim().toLowerCase(),
    source: source || 'bookmark-charts',
    archetype: archetype || null,
    total: total || 0,
    top_category: top_category || null,
    utm: utm || {},
    user_agent: req.headers['user-agent'] || null
  };

  try {
    await fs.appendFile(LEADS_FILE, JSON.stringify(lead) + '\n', 'utf8');
  } catch (e) {
    console.error('append lead failed', e);
  }

  // Best-effort outbound notifications — don't block the response
  Promise.allSettled([
    notifyResend(lead),
    pushToLeadSpot(lead)
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn(['resend','leadspot'][i], 'failed:', r.reason?.message || r.reason);
    });
  });

  res.json({ ok: true });
});

// Convenience: tail last 20 leads (protect with shared secret via ?key=)
app.get('/leads', async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const raw = await fs.readFile(LEADS_FILE, 'utf8').catch(() => '');
    const lines = raw.split('\n').filter(Boolean).slice(-50).map(l => JSON.parse(l));
    res.json({ count: lines.length, leads: lines });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function notifyResend(lead) {
  if (!RESEND_KEY) return { skipped: 'no-resend-key' };
  const body = {
    from: FROM,
    to: [NOTIFY_TO],
    subject: `[Bookmark Charts] New lead — ${lead.email}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:580px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#22d3ee,#8b5cf6);padding:18px 24px;border-radius:10px 10px 0 0">
          <h1 style="color:white;margin:0;font-size:18px;font-weight:700">New Bookmark Charts lead</h1>
        </div>
        <div style="background:#111;color:#e2e8f0;padding:24px;border-radius:0 0 10px 10px">
          <table style="width:100%;font-size:14px;border-collapse:collapse">
            <tr><td style="color:#64748b;padding:6px 0;width:130px">Email</td><td style="color:#fff;padding:6px 0"><strong>${esc(lead.email)}</strong></td></tr>
            <tr><td style="color:#64748b;padding:6px 0">Archetype</td><td style="color:#22d3ee;padding:6px 0">${esc(lead.archetype || '—')}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0">Bookmarks</td><td style="color:#fff;padding:6px 0">${lead.total.toLocaleString()}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0">Top category</td><td style="color:#fff;padding:6px 0">${esc(lead.top_category || '—')}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0">UTM</td><td style="color:#fff;padding:6px 0;font-family:monospace;font-size:12px">${esc(JSON.stringify(lead.utm))}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0">IP</td><td style="color:#94a3b8;padding:6px 0;font-family:monospace;font-size:12px">${esc(lead.ip)}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0">Time</td><td style="color:#94a3b8;padding:6px 0;font-family:monospace;font-size:12px">${esc(lead.ts)}</td></tr>
          </table>
          <p style="font-size:12px;color:#64748b;margin-top:16px;padding-top:16px;border-top:1px solid #2a2a2a">Append to LeadSpot via /leads?key=&lt;admin&gt;</p>
        </div>
      </div>
    `
  };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('resend ' + r.status + ' ' + (await r.text()));
  return r.json();
}

async function pushToLeadSpot(lead) {
  if (!LEADSPOT_URL || !LEADSPOT_KEY) return { skipped: 'no-leadspot-config' };
  const r = await fetch(LEADSPOT_URL.replace(/\/$/, '') + '/api/public/lead-capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': LEADSPOT_KEY },
    body: JSON.stringify({
      email: lead.email,
      firstName: lead.email.split('@')[0],
      tags: ['bookmark-charts', 'lead-magnet', lead.archetype || 'unknown-archetype'].filter(Boolean),
      source: 'Bookmark Charts',
      metadata: { archetype: lead.archetype, total: lead.total, top_category: lead.top_category, utm: lead.utm }
    })
  });
  if (!r.ok) throw new Error('leadspot ' + r.status + ' ' + (await r.text().catch(() => '')));
  return r.json().catch(() => ({}));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

app.listen(PORT, () => {
  console.log(`bookmark-charts-api listening on :${PORT}`);
  console.log(`  data dir: ${DATA_DIR}`);
  console.log(`  resend:   ${RESEND_KEY ? 'configured' : 'disabled'}`);
  console.log(`  leadspot: ${LEADSPOT_URL && LEADSPOT_KEY ? LEADSPOT_URL : 'disabled'}`);
});
