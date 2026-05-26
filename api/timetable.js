// Vercel Serverless Function: /api/timetable
// Replace your GitHub file api/timetable.js with this file.
// It fetches your public Google Sheet on Vercel's server and converts it into the TT object used by index.html.

const GOOGLE_SHEET_ID = "1ZQJqdArlwCS965uw4sbJrB6j8rEPfZerMT7X8qkXSzY";

// Tabs visible in your sheet. Add more tab names here if your sheet owner adds more weekday tabs.
const GOOGLE_SHEET_TABS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Monday (May 11)",
  "Tuesday (May 12)",
  "Wednesday (May 13)",
  "Thursday (May 14)",
  "Friday (May 15)"
];

const SEMESTER_BASE_YEAR = 2026; // Spring 2026: sem 2 -> batch 2025, sem 4 -> 2024, sem 6 -> 2023
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
let SLOTS = ["08:30-09:50", "10:00-11:20", "11:30-12:50", "01:00-02:20", "02:30-03:50", "03:55-05:15"];

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

function normKey(v) {
  return oneLine(v).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeDay(v) {
  const t = oneLine(v).toLowerCase();
  return DAYS.find((d) => t.includes(d.toLowerCase())) || null;
}

function gvizUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&cachebust=${Date.now()}`;
}

function parseGVizText(text) {
  const raw = String(text || "").trim();
  if (raw.startsWith("{")) return JSON.parse(raw);

  const start = raw.indexOf("(");
  const end = raw.lastIndexOf(")");

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Google Sheets returned an unexpected response. Make sure sharing is: Anyone with the link can view.");
  }

  return JSON.parse(raw.slice(start + 1, end));
}

async function loadSheetGrid(sheetName) {
  const res = await fetch(gvizUrl(sheetName), {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 Vercel Timetable Sync" }
  });

  if (!res.ok) {
    throw new Error(`Google Sheets HTTP ${res.status} for tab ${sheetName}`);
  }

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

function parseClock(h, mm, ampm) {
  let hour = Number(h);
  const minute = Number(mm || 0);
  const ap = String(ampm || "").toUpperCase();

  if (ap === "PM" && hour < 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;

  // FAST sheets often write 01:00 without PM. Treat 1-6 as afternoon.
  if (!ap && hour >= 1 && hour <= 6) hour += 12;

  return hour * 60 + minute;
}

function minutesToSlotLabel(min) {
  let h = Math.floor(min / 60);
  const m = min % 60;
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

function slotToMinutes(slot) {
  const start = String(slot || "").split("-")[0] || "";
  const m = start.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 99999;
  return parseClock(m[1], m[2], "");
}

function registerSlot(slot) {
  if (!slot || SLOTS.includes(slot)) return;
  SLOTS.push(slot);
  SLOTS.sort((a, b) => slotToMinutes(a) - slotToMinutes(b));
}

function deptFromText(text) {
  const t = oneLine(text).toUpperCase();
  if (/\bB?AI\b|\bBS\s*\(?\s*AI\s*\)?\b|ARTIFICIAL\s+INTELLIGENCE/.test(t)) return "AI";
  if (/\bB?CS\b|\bBS\s*\(?\s*CS\s*\)?\b|COMPUTER\s+SCIENCE/.test(t)) return "CS";
  return null;
}

function batchFromSemester(sem) {
  const n = Number(sem);
  if (!n || n < 1 || n > 12) return null;
  return String(SEMESTER_BASE_YEAR - Math.ceil(n / 2));
}

function parseClassContext(text) {
  const raw = oneLine(text);
  if (!raw) return null;

  let dept = deptFromText(raw);
  let batch = (raw.match(/\b20\d{2}\b/) || [])[0] || null;
  let section = null;
  let semester = null;

  const patterns = [
    /\bBS\s*\(?\s*(CS|AI)\s*\)?\s*[- ]?([0-9]{1,2})\s*[- ]?([A-Z])\b/i,
    /\bB(CS|AI)\s*[- ]?([0-9]{1,2})\s*[- ]?([A-Z])\b/i,
    /\b(CS|AI)\s*[- ]?([0-9]{1,2})\s*[- ]?([A-Z])\b/i,
    /\b(CS|AI)\s*[- ]?(20\d{2})\s*[- ]?([A-Z])\b/i,
    /\bSEM(?:ESTER)?\s*[-:]?\s*([0-9]{1,2})\b.*?\bSEC(?:TION)?\s*[-:]?\s*([A-Z])\b/i,
    /\b([0-9]{1,2})\s*[- ]?([A-Z])\b/i
  ];

  for (const p of patterns) {
    const m = raw.match(p);
    if (!m) continue;

    if (m[1] && /^(CS|AI)$/i.test(m[1])) dept = dept || m[1].toUpperCase();

    if (m[2] && /^20\d{2}$/.test(m[2])) batch = batch || m[2];
    else if (m[2] && /^\d{1,2}$/.test(m[2])) semester = semester || m[2];
    else if (m[1] && /^\d{1,2}$/.test(m[1])) semester = semester || m[1];

    const possibleSection = [m[3], m[2], m[1]].find((x) => /^[A-Z]$/i.test(String(x || "")));
    if (possibleSection) section = possibleSection.toUpperCase();
  }

  if (!batch && semester) batch = batchFromSemester(semester);

  if (dept && batch && section && /^[A-Z]$/.test(section)) {
    return { dept, batch, section };
  }

  return null;
}

function normalizeRoomName(room) {
  return oneLine(room).toUpperCase().replace(/\s+/g, " ");
}

function sameRoom(a, b) {
  return normalizeRoomName(a) === normalizeRoomName(b);
}

function extractRoom(text) {
  const t = oneLine(text);

  const patterns = [
    /\b([A-D])\s*[- ]\s*(\d{3})\b/i,
    /\b([A-D])\s*[- ]?\s*Lab\s*[-#]?\s*(\d+)\b/i,
    /\bD\s*[- ]?\s*(?:IT\s*)?Lab\s*[-#]?\s*(\d+)\b/i,
    /\b(Margala|Rawal|Mehran|Khyber|Call|DLD|GPU)\s+Labs?\s*\(?\s*(\d+)?\s*\)?/i,
    /\bAudi(?:torium)?\b/i
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;

    if (re === patterns[0]) return `${m[1].toUpperCase()}-${m[2]}`;
    if (re === patterns[1]) return `${m[1].toUpperCase()}-Lab${m[2]}`;
    if (re === patterns[2]) return `D-IT Lab ${m[1]}`;
    if (re === patterns[3]) return `${m[1][0].toUpperCase() + m[1].slice(1)} Lab${m[2] ? " " + m[2] : ""}`;
    return "D-Audi";
  }

  return null;
}

function stripRoomTimeClass(text) {
  return cleanTxt(text)
    .replace(/\b[A-D]\s*[- ]\s*\d{3}\b/gi, " ")
    .replace(/\b[A-D]\s*[- ]?\s*Lab\s*[-#]?\s*\d+\b/gi, " ")
    .replace(/\bD\s*[- ]?\s*(?:IT\s*)?Lab\s*[-#]?\s*\d+\b/gi, " ")
    .replace(/\b(Margala|Rawal|Mehran|Khyber|Call|DLD|GPU)\s+Labs?\s*\(?\s*\d*\s*\)?/gi, " ")
    .replace(/\bAudi(?:torium)?\b/gi, " ")
    .replace(/\d{1,2}[:.]\d{2}\s*(AM|PM)?\s*(?:-|–|—|to)\s*\d{1,2}[:.]\d{2}\s*(AM|PM)?/gi, " ")
    .replace(/\bBS\s*\(?\s*(CS|AI)\s*\)?\s*[- ]?\d{1,2}\s*[- ]?[A-Z]\b/gi, " ")
    .replace(/\bB(CS|AI)\s*[- ]?\d{1,2}\s*[- ]?[A-Z]\b/gi, " ")
    .replace(/\b(CS|AI)\s*[- ]?\d{1,2}\s*[- ]?[A-Z]\b/gi, " ")
    .replace(/\bSEC(?:TION)?\s*[-:]?\s*[A-Z]\b/gi, " ")
    .replace(/\bSEM(?:ESTER)?\s*[-:]?\s*\d{1,2}\b/gi, " ")
    .trim();
}

function looksLikeHeaderOnly(text) {
  const t = oneLine(text).toUpperCase();
  if (!t) return true;
  if (normalizeTimeSlot(t)) return true;
  if (extractRoom(t) && stripRoomTimeClass(t).length < 3) return true;
  if (parseClassContext(t) && stripRoomTimeClass(t).length < 3) return true;
  return /^(CLASS|SECTION|ROOM|VENUE|LOCATION|TIME|SLOT|COURSE|SUBJECT|TEACHER|INSTRUCTOR|FACULTY|THEORY|LAB|BREAK|LUNCH)$/i.test(t);
}

function extractCourse(cell) {
  const cleaned = stripRoomTimeClass(cell);
  const parts = cleaned
    .split(/\n|\r|;|\|/)
    .map(oneLine)
    .map((p) => p.replace(/^[-–—]+|[-–—]+$/g, "").trim())
    .filter(Boolean)
    .filter((p) => !looksLikeHeaderOnly(p));

  // Usually the course name is the first meaningful line before teacher/room lines.
  return parts[0] || "";
}

function addCourseToTT(target, item) {
  const { dept, batch, section, day, course, room, time } = item;
  if (!dept || !batch || !section || !day || !course || !room || !time) return false;

  registerSlot(time);

  target[dept] = target[dept] || {};
  target[dept][batch] = target[dept][batch] || {};
  target[dept][batch][section] = target[dept][batch][section] || {};
  target[dept][batch][section][day] = target[dept][batch][section][day] || [];

  const arr = target[dept][batch][section][day];
  if (!arr.some((x) => x.c === course && sameRoom(x.l, room) && x.t === time)) {
    arr.push({ c: course, l: room, t: time });
    return true;
  }
  return false;
}

function countTTEntries(tt) {
  let n = 0;
  Object.values(tt).forEach((batches) =>
    Object.values(batches).forEach((sections) =>
      Object.values(sections).forEach((days) =>
        Object.values(days).forEach((arr) => {
          n += arr.length;
        })
      )
    )
  );
  return n;
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

function findHeaderIndex(header, names) {
  return header.findIndex((h) => names.some((n) => h.includes(n)));
}

function parseDatabaseRows(grid, tabName, target) {
  let added = 0;

  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const header = (grid[r] || []).map(normKey);

    const idx = {
      dept: findHeaderIndex(header, ["department", "dept", "program", "degree"]),
      batch: findHeaderIndex(header, ["batch", "year", "session"]),
      section: findHeaderIndex(header, ["section", "sec"]),
      klass: findHeaderIndex(header, ["class", "group"]),
      day: findHeaderIndex(header, ["day"]),
      time: findHeaderIndex(header, ["time", "slot"]),
      course: findHeaderIndex(header, ["course", "subject", "title"]),
      room: findHeaderIndex(header, ["room", "venue", "location", "classroom"])
    };

    if (idx.time < 0 || idx.course < 0 || idx.room < 0) continue;

    for (let i = r + 1; i < grid.length; i++) {
      const row = grid[i] || [];
      const time = normalizeTimeSlot(row[idx.time]);
      const day = (idx.day >= 0 ? normalizeDay(row[idx.day]) : null) || normalizeDay(tabName);
      const room = extractRoom(row[idx.room]) || oneLine(row[idx.room]);
      const course = extractCourse(row[idx.course]) || oneLine(row[idx.course]);
      const metaText = [row[idx.klass], row[idx.dept], row[idx.batch], row[idx.section], row.join(" ")].filter(Boolean).join(" ");
      const meta = parseClassContext(metaText);

      if (meta && addCourseToTT(target, { ...meta, day, time, room, course })) added++;
    }
    break;
  }

  return added;
}

function rowHasSeveralTimes(row) {
  return (row || []).filter((x) => normalizeTimeSlot(x)).length >= 2;
}

function timeFromNearbyHeaders(grid, row, col) {
  // Same row: useful for room-wise layouts where the first column is the time slot.
  const sameRowTimes = (grid[row] || []).map((v, c) => ({ c, slot: normalizeTimeSlot(v) })).filter((x) => x.slot);
  if (sameRowTimes.length === 1) return sameRowTimes[0].slot;
  const leftSameRow = sameRowTimes.filter((x) => x.c <= col).sort((a, b) => b.c - a.c)[0];
  if (leftSameRow && col - leftSameRow.c <= 3) return leftSameRow.slot;

  // Above rows: time headers often use merged cells, so Google returns the time only in the left-most merged cell.
  for (let rr = row - 1; rr >= Math.max(0, row - 35); rr--) {
    const headerRow = grid[rr] || [];
    const times = headerRow.map((v, c) => ({ c, slot: normalizeTimeSlot(v) })).filter((x) => x.slot);
    if (!times.length) continue;

    const exact = times.find((x) => x.c === col);
    if (exact) return exact.slot;

    const left = times.filter((x) => x.c <= col).sort((a, b) => b.c - a.c)[0];
    const right = times.filter((x) => x.c > col).sort((a, b) => a.c - b.c)[0];

    // Use the nearest time on the left. This fixes merged header cells.
    if (left && (!right || col - left.c <= right.c - col || col - left.c <= 8)) return left.slot;
    if (right && right.c - col <= 2) return right.slot;
  }

  return null;
}

function roomFromNearby(grid, row, col, cell) {
  let room = extractRoom(cell);
  if (room) return room;

  const rowVals = grid[row] || [];

  // Search nearby same row.
  for (let cc = Math.max(0, col - 8); cc <= Math.min(rowVals.length - 1, col + 3); cc++) {
    room = extractRoom(rowVals[cc]);
    if (room) return room;
  }

  // Search above same/nearby columns for room headers.
  for (let rr = row - 1; rr >= Math.max(0, row - 25); rr--) {
    const r = grid[rr] || [];
    for (let offset = 0; offset <= 5; offset++) {
      for (const cc of [col - offset, col + offset]) {
        if (cc < 0 || cc >= r.length) continue;
        room = extractRoom(r[cc]);
        if (room) return room;
      }
    }
  }

  return null;
}

function rowMetaList(grid) {
  const metas = [];
  let current = null;

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    const leftText = row.slice(0, Math.min(10, row.length)).join(" ");
    const direct = parseClassContext(leftText);

    if (direct) current = direct;

    // Reset carry when the row is clearly a header/title row.
    if (rowHasSeveralTimes(row) || /\b(class|time|room|venue)\b/i.test(oneLine(leftText))) {
      if (!direct) current = null;
    }

    metas[r] = direct || current;
  }

  return metas;
}

function parseMatrixRows(grid, tabName, target) {
  const day = normalizeDay(tabName);
  if (!day) return 0;

  const rowMetas = rowMetaList(grid);
  let added = 0;

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];

    for (let c = 0; c < row.length; c++) {
      const cell = cleanTxt(row[c]);
      if (!cell || looksLikeHeaderOnly(cell)) continue;

      const time = normalizeTimeSlot(cell) || timeFromNearbyHeaders(grid, r, c);
      if (!time) continue;

      const localContext = [
        row.slice(0, Math.min(10, row.length)).join(" "),
        cell,
        ...Array.from({ length: Math.min(r, 8) }, (_, k) => (grid[r - 1 - k] || [])[c] || "")
      ].join(" ");

      const meta = parseClassContext(localContext) || rowMetas[r];
      if (!meta) continue;

      const room = roomFromNearby(grid, r, c, cell);
      if (!room) continue;

      const course = extractCourse(cell);
      if (!course || course.length < 3) continue;

      if (addCourseToTT(target, { ...meta, day, time, room, course })) added++;
    }
  }

  return added;
}

function buildTTWithDiagnostics(sheets) {
  const tt = {};
  const diagnostics = [];

  for (const sheet of sheets) {
    if (sheet.error) {
      diagnostics.push({ name: sheet.name, error: sheet.error, rows: 0, added: 0, samples: [] });
      continue;
    }

    const before = countTTEntries(tt);
    const database = parseDatabaseRows(sheet.grid, sheet.name, tt);
    const matrix = parseMatrixRows(sheet.grid, sheet.name, tt);
    const after = countTTEntries(tt);

    diagnostics.push({
      name: sheet.name,
      rows: sheet.grid.length,
      cols: Math.max(0, ...sheet.grid.map((r) => r.length)),
      added: after - before,
      database,
      matrix,
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

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const requestedSheet = req.query?.sheet;
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
    const count = countTTEntries(tt);

    if (!count) {
      return res.status(500).json({
        ok: false,
        error: "Parsed 0 classes from Google Sheet. API is deployed, but the parser does not match the sheet layout yet. Open /api/timetable?raw=1 and send me the JSON preview.",
        diagnostics
      });
    }

    return res.status(200).json({
      ok: true,
      count,
      slots: SLOTS,
      tt,
      diagnostics,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
