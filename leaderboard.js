// api/leaderboard.js
// Vercel serverless function backing the Compiler Run shared leaderboard.
//
// NOTE: Vercel serverless functions run in an ephemeral, read-mostly
// filesystem — writes made by one invocation are NOT guaranteed to persist
// or be visible to other invocations/regions in production. This
// file-based approach is fine for local dev / small demos. For real
// production persistence, swap readDB()/writeDB() for Vercel KV,
// Supabase, or another proper database while keeping the same JSON shape.

import { promises as fs } from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'leaderboard.json');
const MAX_ENTRIES = 10;

const EMPTY_DB = { players: {}, leaderboard: [] };

async function readDB() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      players: parsed.players || {},
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
    };
  } catch (err) {
    // File missing or unreadable/corrupt — start fresh rather than 500ing.
    return { ...EMPTY_DB, players: {}, leaderboard: [] };
  }
}

async function writeDB(data) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
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
}
