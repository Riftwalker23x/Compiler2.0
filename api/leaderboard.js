// api/leaderboard.js
// Vercel serverless function backing the Compiler Run shared leaderboard.
//
// IMPORTANT: On Vercel, a deployed function's filesystem is READ-ONLY except
// for /tmp. The previous version wrote to `db/leaderboard.json` inside the
// deployment bundle, which throws (EROFS) on every POST in production and
// crashes the function uncaught (FUNCTION_INVOCATION_FAILED). This version:
//   - reads the bundled `db/leaderboard.json` as read-only SEED data
//   - reads/writes the LIVE data at /tmp/leaderboard.json (writable)
//   - never lets an unhandled exception escape the handler
//
// CAVEAT (unchanged from before, now actually load-bearing): /tmp is
// per-instance and ephemeral. It survives repeated calls to a warm
// instance, but a new deploy, scale-out, or cold start after idle can wipe
// it. Fine for a demo/class session. For real persistence, migrate to
// Vercel KV or Supabase, keeping this same JSON shape.

import { promises as fs } from 'fs';
import path from 'path';

const SEED_PATH = path.join(process.cwd(), 'db', 'leaderboard.json');
const LIVE_PATH = path.join('/tmp', 'leaderboard.json');
const MAX_ENTRIES = 10;

function emptyDB() {
  return { players: {}, leaderboard: [] };
}

function normalizeDB(parsed) {
  return {
    players: (parsed && parsed.players) || {},
    leaderboard: Array.isArray(parsed && parsed.leaderboard) ? parsed.leaderboard : [],
  };
}

async function readDB() {
  // 1. Prefer the live, writable copy in /tmp (has real submitted scores).
  try {
    const raw = await fs.readFile(LIVE_PATH, 'utf-8');
    return normalizeDB(JSON.parse(raw));
  } catch (err) {
    // Not there yet (cold instance) — fall through to seed.
  }
  // 2. Fall back to the read-only bundled seed file.
  try {
    const raw = await fs.readFile(SEED_PATH, 'utf-8');
    return normalizeDB(JSON.parse(raw));
  } catch (err) {
    // Seed missing/corrupt — start fresh rather than failing the request.
    return emptyDB();
  }
}

async function writeDB(data) {
  // /tmp always exists on Vercel; no mkdir needed, but keep it defensive.
  await fs.mkdir(path.dirname(LIVE_PATH), { recursive: true });
  await fs.writeFile(LIVE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function rebuildLeaderboard(players) {
  return Object.values(players)
    .sort((a, b) => {
      if (b.highScore !== a.highScore) return b.highScore - a.highScore;
      // Tied scores: earlier achievedAt ranks higher.
      return new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime();
    })
    .slice(0, MAX_ENTRIES);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const db = await readDB();
      return res.status(200).json({ leaderboard: db.leaderboard });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const { nuid, name, section, department, batch, score } = body || {};

      if (!nuid || typeof nuid !== 'string') {
        return res.status(400).json({ error: 'nuid is required' });
      }
      const numericScore = Number(score);
      if (!Number.isFinite(numericScore)) {
        return res.status(400).json({ error: 'score must be a number' });
      }

      const db = await readDB();
      const key = nuid.trim().toUpperCase();
      const existing = db.players[key];

      if (!existing || numericScore > existing.highScore) {
        db.players[key] = {
          nuid: key,
          name: (name && String(name)) || existing?.name || 'Unknown',
          section: (section && String(section)) || existing?.section || '-',
          department: (department && String(department)) || existing?.department || '-',
          batch: (batch && String(batch)) || existing?.batch || '-',
          highScore: numericScore,
          achievedAt: new Date().toISOString(),
        };
      }

      db.leaderboard = rebuildLeaderboard(db.players);
      await writeDB(db);

      return res.status(200).json({ leaderboard: db.leaderboard });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    // Never let this escape uncaught again — always send a real response
    // with the actual error message so DevTools shows something useful.
    console.error('leaderboard API error:', err);
    return res.status(500).json({ error: 'Internal error', message: err?.message || String(err) });
  }
}