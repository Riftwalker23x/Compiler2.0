// Runs when a timetable JSON changes. Detects classes that became Cancelled or
// Rescheduled and notifies affected users (matched by department + batch +
// section from their stored subscription).
//
// Env: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY (required), VAPID_SUBJECT (optional)
//
// Reads:  db/timetable-*.json, db/push-subscriptions.json
// Writes: db/class-notify-state.json  (slotKey -> "status|time|venue" last seen)
//
// The state file makes this a change detector: first run just records the
// baseline (no spam); afterwards only slots whose status/time/venue differ fire.

import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';

const DB = 'db';
const SUBS = path.join(DB, 'push-subscriptions.json');
const STATE = path.join(DB, 'class-notify-state.json');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; }
}
function writeJson(p, val) { fs.writeFileSync(p, JSON.stringify(val, null, 2) + '\n'); }

const priv = process.env.VAPID_PRIVATE_KEY;
const pub = process.env.VAPID_PUBLIC_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:compilersociety@gmail.com';
if (!priv || !pub) { console.log('VAPID keys not set — skipping class push.'); process.exit(0); }
webpush.setVapidDetails(subject, pub, priv);

const deptKeyOf = (dep) => String(dep || '').replace(/^BS\s+/i, '').trim().toUpperCase(); // "BS CS" | "CS" -> "CS"
const fullBatch = (b) => (/^\d{2}$/.test(String(b || '').trim()) ? '20' + String(b).trim() : String(b || '').trim());
const sectionLetter = (s) => String(s || '').replace(/[^A-Za-z]/g, '').toUpperCase();

function classStatus(name) {
  const t = String(name || '');
  if (/cancel/i.test(t)) return 'Cancelled';
  if (/\bresch\b|reschedul/i.test(t)) return 'Rescheduled';
  return 'Normal';
}
function cleanCourseName(name) {
  return String(name || '').replace(/\s*(ReSch(eduled)?|Cancelled|Cancel)\b.*$/i, '').trim() || 'your class';
}

// Build current snapshot of every class slot across all timetable files.
const files = fs.existsSync(DB) ? fs.readdirSync(DB).filter((f) => /^timetable-.*\.json$/.test(f)) : [];
const current = new Map(); // slotKey -> { value, meta }
for (const f of files) {
  const doc = readJson(path.join(DB, f), null);
  const tt = doc && doc.tt ? doc.tt : null;
  if (!tt) continue;
  for (const dep of Object.keys(tt)) {
    for (const batch of Object.keys(tt[dep] || {})) {
      for (const section of Object.keys(tt[dep][batch] || {})) {
        for (const day of Object.keys(tt[dep][batch][section] || {})) {
          const slots = tt[dep][batch][section][day] || [];
          slots.forEach((c, idx) => {
            const status = classStatus(c.name);
            const course = cleanCourseName(c.name);
            const key = [dep, batch, section, day, course, idx].join('|');
            current.set(key, {
              value: `${status}|${c.time || ''}|${c.location || ''}`,
              meta: {
                deptKey: deptKeyOf(dep), batch: fullBatch(batch), secLetter: sectionLetter(section),
                section, course, day, status, time: c.time || '—', venue: c.location || '—',
              },
            });
          });
        }
      }
    }
  }
}

if (current.size === 0) { console.log('No timetable data — nothing to do.'); process.exit(0); }

const prevState = readJson(STATE, {});
const firstRun = Object.keys(prevState).length === 0;

// A slot is "changed" if it is now Cancelled/Rescheduled and differs from before.
const changed = [];
if (!firstRun) {
  for (const [key, { value, meta }] of current) {
    if (meta.status === 'Normal') continue;                 // only cancels/reschedules matter
    if (prevState[key] === value) continue;                 // unchanged -> no notify
    changed.push(meta);
  }
}

// Persist new snapshot for next run.
const newState = {};
for (const [key, { value }] of current) newState[key] = value;
writeJson(STATE, newState);

if (firstRun) { console.log('First run — recorded class snapshot, no notifications sent.'); process.exit(0); }
if (changed.length === 0) { console.log('No class cancellations/reschedules.'); process.exit(0); }

const subs = readJson(SUBS, []);
if (!Array.isArray(subs) || subs.length === 0) { console.log('Classes changed but no subscriptions.'); process.exit(0); }

let sent = 0, skipped = 0;
for (const entry of subs) {
  const subscription = entry?.subscription;
  if (!subscription?.endpoint) continue;
  const dep = deptKeyOf(entry.department);
  const batch = fullBatch(entry.batch);
  const secLetter = sectionLetter(entry.section);
  if (!dep || !batch || !secLetter) { skipped++; continue; }

  const mine = changed.filter((c) => c.deptKey === dep && c.batch === batch && c.secLetter === secLetter);
  if (mine.length === 0) { skipped++; continue; }

  const name = String(entry.name || '').trim() || 'Student';
  for (const c of mine) {
    const body = c.status === 'Cancelled'
      ? `Dear ${name}, your class ${c.course} (${c.section}) has been cancelled.`
      : `Dear ${name}, your class ${c.course} (${c.section}) has been rescheduled to ${c.time} at ${c.venue}.`;
    const payload = JSON.stringify({
      title: c.status === 'Cancelled' ? 'Class cancelled' : 'Class rescheduled',
      body,
      url: '/',
      tag: `class-${c.deptKey}-${c.batch}-${c.secLetter}-${c.course}-${c.day}`,
    });
    try {
      await webpush.sendNotification(subscription, payload);
      sent++;
    } catch (err) {
      const code = err?.statusCode;
      if (code !== 404 && code !== 410) console.warn(`class push failed (${code || 'err'}): ${err?.message || err}`);
    }
  }
}

console.log(`Class push summary — sent: ${sent}, skipped: ${skipped}, changed slots: ${changed.length}`);
