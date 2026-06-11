// Vercel Serverless Function: /api/timetable
// Parses the Compiler Society timetable Google Sheet using the correct
// room×slot matrix layout:
//   Row with "Room" in col A → time slot headers at cols B,F,J,N,R,V,Z,AD
//   Data rows → col A = room, cells at slot cols = "Course (DEPT-Section[, batch])"
//   Row with "Lab" in col A → lab slot headers at cols B,F,J,N
//   Lab data rows → same layout, 3-hour slot spans

const GOOGLE_SHEET_ID = "1ZQJqdArlwCS965uw4sbJrB6j8rEPfZerMT7X8qkXSzY";
const GOOGLE_SHEET_TABS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/* ── Text helpers ── */

function cleanTxt(v) {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function oneLine(v) {
  return cleanTxt(v).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

/* ── Google Sheets fetch ── */

function gvizUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&cachebust=${Date.now()}`;
}

function parseGVizText(text) {
  const raw = String(text || "").trim();
  if (raw.startsWith("{")) return JSON.parse(raw);
  const start = raw.indexOf("("), end = raw.lastIndexOf(")");
  if (start < 0 || end < 0 || end <= start)
    throw new Error("Google Sheets returned an unexpected response. Make sure sharing is: Anyone with the link can view.");
  return JSON.parse(raw.slice(start + 1, end));
}

async function loadSheetGrid(sheetName) {
  const res = await fetch(gvizUrl(sheetName), {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 Vercel Timetable Sync" }
  });
  if (!res.ok) throw new Error(`Google Sheets HTTP ${res.status} for tab ${sheetName}`);
  const data = parseGVizText(await res.text());
  const rows = data?.table?.rows || [];
  const colCount = Math.max(data?.table?.cols?.length || 0, ...rows.map((r) => (r.c || []).length), 0);
  return rows.map((r) =>
    Array.from({ length: colCount }, (_, i) => {
      const cell = (r.c || [])[i];
      if (!cell) return "";
      return cleanTxt(cell.f ?? cell.v ?? "");
    })
  );
}

function countReferenceEntries(tt) {
  let n = 0;
  Object.values(tt || {}).forEach((deps) =>
    Object.values(deps || {}).forEach((batches) =>
      Object.values(batches || {}).forEach((sections) =>
        Object.values(sections || {}).forEach((arr) => {
          n += (arr || []).length;
        })
      )
    )
  );
  return n;
}

function legacyTTToReferenceTT(tt) {
  const out = {};
  Object.entries(tt || {}).forEach(([depCode, batches]) => {
    const depLabel = `BS ${depCode}`;
    out[depLabel] = out[depLabel] || {};
    Object.entries(batches || {}).forEach(([batch, sections]) => {
      out[depLabel][batch] = out[depLabel][batch] || {};
      Object.entries(sections || {}).forEach(([section, days]) => {
        out[depLabel][batch][section] = out[depLabel][batch][section] || {};
        Object.entries(days || {}).forEach(([day, arr]) => {
          out[depLabel][batch][section][day] = (arr || []).map((entry) => ({
            name: entry.c,
            location: entry.l,
            time: entry.t
          }));
        });
      });
    });
  });
  return out;
}

async function fetchReferenceTimetable() {
  const url = `https://fastschedule.github.io/db/timetable.json?v=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Reference timetable HTTP ${res.status}`);
  const tt = await res.json();
  if (!tt || typeof tt !== "object") throw new Error("Reference timetable payload is empty");
  return tt;
}

/* ── Time helpers ── */

function parseClock(h, mm, ampm) {
  let hour = Number(h), minute = Number(mm || 0);
  const ap = (ampm || "").toUpperCase();
  if (ap === "PM" && hour < 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;
  if (!ap && hour >= 1 && hour <= 6) hour += 12;
  return hour * 60 + minute;
}

function minutesToSlotLabel(min) {
  let h = Math.floor(min / 60), m = min % 60;
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizeTimeSlot(text) {
  const t = oneLine(text).replace(/[–—]/g, "-");
  const m = t.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*(?:-|to)\s*(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  const start = parseClock(m[1], m[2], m[3] || m[6]);
  const end = parseClock(m[4], m[5], m[6] || m[3]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return `${minutesToSlotLabel(start)}-${minutesToSlotLabel(end)}`;
}

const SLOT_MINUTE_MAP = {
  "08:30":510, "09:50":590,
  "10:00":600, "11:20":680,
  "11:30":690, "12:50":770,
  "01:00":780, "02:20":860,
  "02:30":870, "03:50":950,
  "03:55":955, "05:15":1035,
  "05:20":1040, "06:40":1120,
  "06:45":1125, "08:05":1205,
  "08:30-11:15":510, "11:30-02:15":690,
  "02:30-05:15":870, "05:20-08:05":1040,
};

function slotToMinutes(slot) {
  if (slot in SLOT_MINUTE_MAP) return SLOT_MINUTE_MAP[slot];
  const start = String(slot || "").split("-")[0] || "";
  return SLOT_MINUTE_MAP[start] ?? 99999;
}

/* ── Room helpers ── */

function normalizeRoomName(room) {
  let r = oneLine(room).toUpperCase();
  r = r.replace(/\s+/g, " ");

  // C 301 → C-301
  r = r.replace(/\b([A-D])\s+(\d{3})\b/, "$1-$2");
  // D IT Lab 1 → D-IT LAB 1
  r = r.replace(/\b([A-D])\s+(IT\s+)?LAB\s*[-#]?\s*(\d+)\b/i, "$1-$2LAB $3");
  // C Margala 1 → C-MARGALA 1
  r = r.replace(/\b([A-D])\s+(MARGALA|RAWAL)\s+(\d+)\b/i, "$1-$2 $3");
  // C GPU Lab → C-GPU LAB
  r = r.replace(/\b([A-D])\s+GPU\s+LAB\b/i, "$1-GPU LAB");
  // A Mehran 1 → A-MEHRAN 1
  r = r.replace(/\b([A-D])\s+(MEHRAN|CALL)\s*[-#]?\s*(\d*)\b/i, "$1-$2 $3").trim();
  // B Digital → B-DIGITAL
  r = r.replace(/\b([A-D])\s+(DIGITAL)\b/i, "$1-$2");

  // Cyber (D-514)
  let m = r.match(/CYBER\s*\(?\s*([A-D])-(\d{3})/i);
  if (m) return `Cyber (${m[1].toUpperCase()}-${m[2]})`;

  if (/\bAUDI(TORIUM)?\b/.test(r)) return "D-AUDI";
  return r;
}

function sameRoom(a, b) {
  return normalizeRoomName(a) === normalizeRoomName(b);
}

/* ── TT building ── */

function countTTEntries(tt) {
  let n = 0;
  Object.values(tt).forEach((batches) =>
    Object.values(batches).forEach((sections) =>
      Object.values(sections).forEach((days) =>
        Object.values(days).forEach((arr) => { n += arr.length; })
      )
    )
  );
  return n;
}

const SLOTS = [];

function registerSlot(slot) {
  if (!slot || SLOTS.includes(slot)) return;
  SLOTS.push(slot);
  SLOTS.sort((a, b) => slotToMinutes(a) - slotToMinutes(b));
}

function addCourseToTT(target, { dept, batch, section, day, course, room, time }) {
  if (!dept || !batch || !section || !day || !course || !room || !time) return false;
  registerSlot(time);
  const depts = Array.isArray(dept) ? dept : [dept];
  let added = false;
  for (const deptCode of depts) {
    if (!deptCode) continue;
    target[deptCode] = target[deptCode] || {};
    target[deptCode][batch] = target[deptCode][batch] || {};
    target[deptCode][batch][section] = target[deptCode][batch][section] || {};
    target[deptCode][batch][section][day] = target[deptCode][batch][section][day] || [];
    const arr = target[deptCode][batch][section][day];
    if (!arr.some((x) => x.c === course && sameRoom(x.l, room) && x.t === time)) {
      arr.push({ c: course, l: room, t: time });
      added = true;
    }
  }
  return added;
}

/* ══════════════════════════════════════════
   PARSER — Cell parser, grid walker
   ══════════════════════════════════════════ */

const SLOT_COLS = {
  1: "08:30-09:50", 6: "10:00-11:20", 11: "11:30-12:50",
  16: "01:00-02:20", 21: "02:30-03:50", 26: "03:55-05:15",
  31: "05:20-06:40", 36: "06:45-08:05",
};

const LAB_SLOT_COLS = {
  1: "08:30-11:15", 11: "11:30-02:15", 21: "02:30-05:15", 31: "05:20-08:05",
};

const BATCH_MAP = { "25": "2025", "24": "2024", "22": "2022" };
const CELL_REGEX = /(.+?)\s*\(([A-Z]+(?:\/[A-Z]+)*)(?:-([A-Z0-9]+))?(?:,\s*(?:Gp?-([IV]+)|(\d{2})))?\s*\)/i;

function parseTimetableCell(text) {
  const t = oneLine(text);
  if (!t) return null;
  // Strip everything after the first ) to handle trailing room/time info
  const parenEnd = t.indexOf(")");
  const core = parenEnd >= 0 ? t.slice(0, parenEnd + 1) : t;
  const m = core.match(CELL_REGEX);
  if (!m) return null;
  const course = m[1].trim();
  const deptStr = m[2];
  const section = m[3];
  if (!section) return null;
  const batchShort = m[5];
  const batch = batchShort ? (BATCH_MAP[batchShort] || "20" + batchShort) : "2023";
  const depts = deptStr.includes("/") ? deptStr.split("/") : [deptStr];
  return { depts, section, batch, course };
}

function findHeaderRow(grid) {
  const candidates = [];
  for (let r = 0; r < Math.min(grid.length, 10); r++) {
    const cell = oneLine(grid[r][0] || "");
    if (/room/i.test(cell)) {
      let slotsFound = 0;
      for (const cIdx of Object.keys(SLOT_COLS)) {
        const v = oneLine(grid[r][parseInt(cIdx)] || "");
        if (normalizeTimeSlot(v)) slotsFound++;
      }
      if (slotsFound >= 4) return r;
      candidates.push(r);
    }
  }
  if (candidates.length) return candidates[0];
  return -1;
}

function findLabHeaderRow(grid, afterRow) {
  for (let r = afterRow; r < grid.length; r++) {
    const colA = oneLine(grid[r][0] || "").toLowerCase();
    if (colA.includes("lab")) return r;
    const colB = oneLine(grid[r][1] || "");
    if (/^\d{1,2}:\d{2}-(?:1[0-5]|0\d|2[0-3]):\d{2}$/.test(colB) && grid[r].filter(c => oneLine(c)).length <= 6) return r;
  }
  return -1;
}

const CLASSROOM_LEFT_BLOCK = {
  roomCol: 0,
  endCol: 30,
  slotCols: [1, 6, 11, 16, 21, 26],
  slotMap: { 1: "08:30-09:50", 6: "10:00-11:20", 11: "11:30-12:50", 16: "01:00-02:20", 21: "02:30-03:50", 26: "03:55-05:15" }
};
const CLASSROOM_RIGHT_BLOCK = {
  roomCol: 30,
  endCol: null,
  slotCols: [31, 36],
  slotMap: { 31: "05:20-06:40", 36: "06:45-08:05" }
};
const LAB_BLOCK = {
  roomCol: 0,
  endCol: null,
  slotCols: [1, 11, 21, 31],
  slotMap: { 1: "08:30-11:15", 11: "11:30-02:15", 21: "02:30-05:15", 31: "05:20-08:05" }
};

function slotForColumn(col, slotCols) {
  let chosen = null;
  for (const slotCol of slotCols) {
    if (slotCol <= col) chosen = slotCol;
  }
  return chosen;
}

function parseRoomBlockRows(grid, startRow, endRow, block, day, target) {
  let added = 0;
  for (let r = startRow; r < Math.min(endRow, grid.length); r++) {
    const row = grid[r] || [];
    const room = normalizeRoomName(oneLine(row[block.roomCol] || ""));
    if (!room || room.length < 2 || /reserved|tutorial|fsm|fsa|fcss|fyp|travel|admin|room/i.test(room)) continue;
    for (let i = 0; i < block.slotCols.length; i++) {
      const timeCol = block.slotCols[i];
      const nextCol = block.slotCols[i + 1] ?? (block.endCol ?? row.length);
      const scanEnd = Math.min(nextCol, block.endCol ?? row.length, row.length);
      let parsed = null;
      for (let col = timeCol; col < scanEnd; col++) {
        const cell = oneLine(row[col] || "");
        if (!cell) continue;
        parsed = parseTimetableCell(cell);
        if (parsed) {
          for (const dept of parsed.depts) {
            if (addCourseToTT(target, { dept, batch: parsed.batch, section: parsed.section, day, course: parsed.course, room, time: block.slotMap[timeCol] })) added++;
          }
          break;
        }
      }
    }
  }
  return added;
}

function parseGridToTT(grid, day, target) {
  const hr = findHeaderRow(grid);
  if (hr < 0) return 0;
  const lr = findLabHeaderRow(grid, hr + 1);
  const classroomEnd = lr > 0 ? lr : grid.length;
  let added = 0;
  added += parseRoomBlockRows(grid, hr + 1, classroomEnd, CLASSROOM_LEFT_BLOCK, day, target);
  added += parseRoomBlockRows(grid, hr + 1, classroomEnd, CLASSROOM_RIGHT_BLOCK, day, target);
  if (lr > 0) added += parseRoomBlockRows(grid, lr + 1, grid.length, LAB_BLOCK, day, target);
  return added;
}

/* ══════════════════════════════════════════
   Main Orchestrator
   ══════════════════════════════════════════ */

function normalizeDay(v) {
  const t = oneLine(v).toLowerCase();
  return DAYS.find((d) => t.includes(d.toLowerCase())) || null;
}

function nonEmptySamples(grid, max = 30) {
  const samples = [];
  for (let r = 0; r < grid.length && samples.length < max; r++) {
    for (let c = 0; c < (grid[r] || []).length && samples.length < max; c++) {
      const v = oneLine(grid[r][c]);
      if (v) samples.push({ r: r + 1, c: c + 1, v: v.slice(0, 160) });
    }
  }
  return samples;
}

function buildTTWithDiagnostics(sheets) {
  const tt = {};
  const diagnostics = [];
  SLOTS.length = 0;

  for (const sheet of sheets) {
    if (sheet.error) {
      diagnostics.push({ name: sheet.name, error: sheet.error, rows: 0, added: 0, samples: [] });
      continue;
    }
    const before = countTTEntries(tt);
    const day = normalizeDay(sheet.name);
    if (day) parseGridToTT(sheet.grid, day, tt);
    const after = countTTEntries(tt);
    diagnostics.push({
      name: sheet.name,
      rows: sheet.grid.length,
      cols: Math.max(0, ...sheet.grid.map((r) => r.length)),
      added: after - before,
      samples: nonEmptySamples(sheet.grid, 12)
    });
  }

  Object.values(tt).forEach((batches) =>
    Object.values(batches).forEach((sections) =>
      Object.values(sections).forEach((days) =>
        Object.values(days).forEach((arr) => arr.sort((a, b) => slotToMinutes(a.t) - slotToMinutes(b.t)))
      )
    )
  );

  return { tt, diagnostics };
}

/* ══════════════════════════════════════════
   Vercel Handler
   ══════════════════════════════════════════ */

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const requestedSheet = req.query?.sheet;

    if (!requestedSheet) {
      try {
        const referenceTT = await fetchReferenceTimetable();
        return res.status(200).json({
          ok: true,
          count: countReferenceEntries(referenceTT),
          tt: referenceTT,
          updatedAt: new Date().toISOString(),
          source: "fastschedule.github.io"
        });
      } catch (referenceErr) {
        // Fall through to live Google Sheets parsing below.
      }
    }

    const tabs = requestedSheet ? [requestedSheet] : GOOGLE_SHEET_TABS;
    const uniqueTabs = [...new Set(tabs)];

    const sheets = [];
    for (const tab of uniqueTabs) {
      try {
        const grid = await loadSheetGrid(tab);
        sheets.push({ name: tab, grid });
      } catch (err) {
        sheets.push({ name: tab, grid: [], error: err.message || String(err) });
      }
    }

    if (req.query?.raw) {
      return res.status(200).json({
        ok: true,
        tabs: uniqueTabs,
        sheets: sheets.map((s) => ({
          name: s.name,
          error: s.error,
          rows: s.grid.length,
          cols: Math.max(0, ...s.grid.map((r) => r.length)),
          preview: s.grid.slice(0, 35),
          samples: nonEmptySamples(s.grid, 50)
        }))
      });
    }

    const { tt, diagnostics } = buildTTWithDiagnostics(sheets);
    const refTT = legacyTTToReferenceTT(tt);
    const count = countReferenceEntries(refTT);

    if (!count) {
      return res.status(500).json({
        ok: false,
        error: "Parsed 0 classes from Google Sheet. Open /api/timetable?raw=1 and send the JSON preview to debug.",
        diagnostics
      });
    }

    return res.status(200).json({
      ok: true,
      count,
      tt: refTT,
      diagnostics,
      updatedAt: new Date().toISOString(),
      source: "google-sheet-fallback"
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
