// Vercel Serverless Function: /api/timetable
// This avoids browser CORS problems by fetching Google Sheets from the server.

const GOOGLE_SHEET_ID = "1ZQJqdArlwCS965uw4sbJrB6j8rEPfZerMT7X8qkXSzY";
const GOOGLE_SHEET_TABS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Monday (May 11)",
  "Tuesday (May 12)"
];

const SEMESTER_BASE_YEAR = 2026;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
let SLOTS = ["08:30-09:50", "10:00-11:20", "11:30-12:50", "01:00-02:20", "02:30-03:30"];

function cleanTxt(v) {
  return String(v ?? "").replace(/ /g, " ").replace(/[\t ]+/g, " ").trim();
}

function normKey(v) {
  return cleanTxt(v).toLowerCase().replace(/[^a-z0-9]+/g, "");
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
    throw new Error("Unexpected Google Sheets response. Confirm the sheet is shared as Anyone with the link can view.");
  }

  return JSON.parse(raw.slice(start + 1, end));
}

async function loadSheetGrid(sheetName) {
  const res = await fetch(gvizUrl(sheetName), {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 Vercel Timetable Sync"
    }
  });

  if (!res.ok) {
    throw new Error(`Google Sheets HTTP ${res.status} for tab "${sheetName}"`);
  }

  const data = parseGVizText(await res.text());
  const rows = (data.table && data.table.rows) || [];

  const colCount = Math.max(
    (data.table && data.table.cols && data.table.cols.length) || 0,
    ...rows.map((r) => (r.c || []).length),
    0
  );

  return rows.map((r) =>
    Array.from({ length: colCount }, (_, i) => {
      const cell = (r.c || [])[i];
      if (!cell) return "";
      return cleanTxt(cell.f ?? cell.v ?? "");
    })
  );
}

function slotToMinutes(timeStr) {
  const [hh, mm] = String(timeStr).split(":").map(Number);
  const hour = hh >= 1 && hh <= 6 ? hh + 12 : hh;
  return hour * 60 + mm;
}

function deptFromText(text) {
  const t = cleanTxt(text).toUpperCase();

  if (/\b(BS\s*)?\(?AI\)?\b|\bBAI\b|ARTIFICIAL\s+INTELLIGENCE/.test(t)) return "AI";
  if (/\b(BS\s*)?\(?CS\)?\b|\bBCS\b|COMPUTER\s+SCIENCE/.test(t)) return "CS";

  return null;
}

function batchFromSemester(sem) {
  const n = Number(sem);
  if (!n || n < 1 || n > 12) return null;
  return String(SEMESTER_BASE_YEAR - Math.ceil(n / 2));
}

function parseClassContext(text) {
  const raw = cleanTxt(text);
  const t = raw.toUpperCase();

  let dept = deptFromText(t);
  let batch = (t.match(/\b20\d{2}\b/) || [])[0] || null;
  let section = null;
  let semester = null;

  const patterns = [
    /\bB(?:S)?\s*\(?\s*(CS|AI)\s*\)?\s*[- ]?([0-9]{1,2})?\s*[- ]?([A-D])\b/i,
    /\bB(CS|AI)\s*[- ]?([0-9]{1,2})?\s*[- ]?([A-D])\b/i,
    /\b(CS|AI)\s*[- ]?(20\d{2})\s*[- ]?([A-D])\b/i,
    /\b(CS|AI)\s*[- ]?([0-9]{1,2})\s*[- ]?([A-D])\b/i,
    /\b(?:SEC(?:TION)?\s*[-:]?\s*)([A-D])\b/i,
    /\b([0-9]{1,2})([A-D])\b/i
  ];

  for (const p of patterns) {
    const m = raw.match(p);
    if (!m) continue;

    if (m[1] && /^(CS|AI)$/i.test(m[1])) dept = dept || m[1].toUpperCase();

    if (m[2] && /^20\d{2}$/.test(m[2])) batch = batch || m[2];
    else if (m[2] && /^\d{1,2}$/.test(m[2])) semester = semester || m[2];

    if (m[3] && /^[A-D]$/i.test(m[3])) section = m[3].toUpperCase();
    else if (m[1] && /^[A-D]$/i.test(m[1])) section = m[1].toUpperCase();
    else if (m[2] && /^[A-D]$/i.test(m[2])) section = m[2].toUpperCase();
  }

  if (!batch && semester) batch = batchFromSemester(semester);

  return dept && batch && section ? { dept, batch, section } : null;
}

function normalizeDay(day) {
  const t = cleanTxt(day).toLowerCase();
  return DAYS.find((d) => t.includes(d.toLowerCase())) || null;
}

function minutesToSlotLabel(min) {
  let h = Math.floor(min / 60);
  const m = min % 60;

  if (h > 12) h -= 12;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseClock(h, mm, ampm) {
  let hour = Number(h);
  const minute = Number(mm || 0);
  const ap = (ampm || "").toUpperCase();

  if (ap === "PM" && hour < 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;

  // FAST timetable style: 01:00 means 1 PM
  if (!ap && hour >= 1 && hour <= 6) hour += 12;

  return hour * 60 + minute;
}

function normalizeTimeSlot(text) {
  const t = cleanTxt(text).replace(/[–—]/g, "-");

  const m = t.match(
    /(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*(?:-|to)\s*(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i
  );

  if (!m) return null;

  const start = parseClock(m[1], m[2], m[3] || m[6]);
  const end = parseClock(m[4], m[5], m[6] || m[3]);

  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return `${minutesToSlotLabel(start)}-${minutesToSlotLabel(end)}`;
}

function registerSlot(slot) {
  if (!slot || SLOTS.includes(slot)) return;

  SLOTS.push(slot);
  SLOTS.sort((a, b) => slotToMinutes(a.split("-")[0]) - slotToMinutes(b.split("-")[0]));
}

function normalizeRoomName(room) {
  let r = cleanTxt(room).toUpperCase();
  r = r.replace(/\s+/g, " ");

  let m = r.match(/\b([A-D])\s*[- ]\s*(\d{3})\b/);
  if (m) return `${m[1]}-${m[2]}`;

  m = r.match(/\bD\s*[- ]?\s*(?:IT\s*)?LAB\s*[-#]?\s*(\d+)\b/);
  if (m) return `D-IT LAB ${m[1]}`;

  m = r.match(/\b([CD])\s*[- ]?\s*LAB\s*[-#]?\s*(\d+)\b/);
  if (m) return `${m[1]}-LAB${m[2]}`;

  m = r.match(/\b(MARGALA|RAWAL|MEHRAN|KHYBER|CALL|DLD|GPU)\s+LABS?\s*\(?\s*(\d+)?\s*\)?/);
  if (m) return `${m[1][0]}${m[1].slice(1).toLowerCase()} Lab${m[2] ? " " + m[2] : ""}`.toUpperCase();

  if (/\bAUDI(TORIUM)?\b/.test(r)) return "D-AUDI";

  return r;
}

function sameRoom(a, b) {
  return normalizeRoomName(a) === normalizeRoomName(b);
}

function extractRoom(text) {
  const t = cleanTxt(text);

  const tests = [
    /\b([A-D])\s*[- ]\s*(\d{3})\b/i,
    /\bD\s*[- ]?\s*(?:IT\s*)?Lab\s*[-#]?\s*(\d+)\b/i,
    /\b([CD])\s*[- ]?\s*Lab\s*[-#]?\s*(\d+)\b/i,
    /\b(Margala|Rawal|Mehran|Khyber|Call|DLD|GPU)\s+Labs?\s*\(?\s*(\d+)?\s*\)?/i,
    /\bAudi(?:torium)?\b/i
  ];

  for (const re of tests) {
    const m = t.match(re);
    if (!m) continue;

    if (re === tests[0]) return `${m[1].toUpperCase()}-${m[2]}`;
    if (re === tests[1]) return `D-IT Lab ${m[1]}`;
    if (re === tests[2]) return `${m[1].toUpperCase()}-Lab${m[2]}`;
    if (re === tests[3]) return `${m[1][0].toUpperCase() + m[1].slice(1)} Lab${m[2] ? " " + m[2] : ""}`;

    return "D-Audi";
  }

  return null;
}

function stripRoomAndTime(text) {
  return cleanTxt(text)
    .replace(/\b[A-D]\s*[- ]\s*\d{3}\b/ig, " ")
    .replace(/\bD\s*[- ]?\s*(?:IT\s*)?Lab\s*[-#]?\s*\d+\b/ig, " ")
    .replace(/\b[CD]\s*[- ]?\s*Lab\s*[-#]?\s*\d+\b/ig, " ")
    .replace(/\b(Margala|Rawal|Mehran|Khyber|Call|DLD|GPU)\s+Labs?\s*\(?\s*\d*\s*\)?/ig, " ")
    .replace(/\bAudi(?:torium)?\b/ig, " ")
    .replace(/\d{1,2}[:.]\d{2}\s*(AM|PM)?\s*(?:-|–|—|to)\s*\d{1,2}[:.]\d{2}\s*(AM|PM)?/ig, " ")
    .trim();
}

function addCourseToTT(target, { dept, batch, section, day, course, room, time }) {
  if (!dept || !batch || !section || !day || !course || !room || !time) return false;

  registerSlot(time);

  target[dept] = target[dept] || {};
  target[dept][batch] = target[dept][batch] || {};
  target[dept][batch][section] = target[dept][batch][section] || {};
  target[dept][batch][section][day] = target[dept][batch][section][day] || [];

  const arr = target[dept][batch][section][day];

  if (!arr.some((x) => x.c === course && sameRoom(x.l, room) && x.t === time)) {
    arr.push({ c: course, l: room, t: time });
  }

  return true;
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

function parseDatabaseRows(grid, tabName, target) {
  let added = 0;

  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const header = grid[r].map(normKey);

    const findIdx = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));

    const idx = {
      dept: findIdx(["department", "dept", "program", "degree"]),
      batch: findIdx(["batch", "year", "session"]),
      section: findIdx(["section", "sec"]),
      class: findIdx(["class", "group"]),
      day: findIdx(["day"]),
      time: findIdx(["time", "slot"]),
      course: findIdx(["course", "subject", "title"]),
      room: findIdx(["room", "venue", "location", "classroom"])
    };

    if (idx.time < 0 || idx.course < 0 || idx.room < 0) continue;

    for (let i = r + 1; i < grid.length; i++) {
      const row = grid[i];

      const time = normalizeTimeSlot(row[idx.time]);
      const day = (idx.day >= 0 ? normalizeDay(row[idx.day]) : null) || normalizeDay(tabName);
      const room = extractRoom(row[idx.room]) || cleanTxt(row[idx.room]);
      const course = cleanTxt(row[idx.course]);

      const meta = parseClassContext(
        [row[idx.class], row[idx.dept], row[idx.batch], row[idx.section], row.join(" ")]
          .filter(Boolean)
          .join(" ")
      );

      if (meta && addCourseToTT(target, { ...meta, day, time, room, course })) added++;
    }

    break;
  }

  return added;
}

function collectHeaderContext(grid, row, col) {
  const bits = [];

  for (let rr = Math.max(0, row - 12); rr < row; rr++) {
    for (let cc = Math.max(0, col - 5); cc <= Math.min((grid[rr] || []).length - 1, col + 5); cc++) {
      const v = cleanTxt(grid[rr][cc]);
      if (v) bits.push(v);
    }
  }

  for (let cc = 0; cc < col; cc++) {
    const v = cleanTxt(grid[row][cc]);
    if (v && !normalizeTimeSlot(v)) bits.push(v);
  }

  return bits.join(" ");
}

function stripClassCodes(text) {
  return cleanTxt(text)
    .replace(/\bB(?:S)?\s*\(?\s*(CS|AI)\s*\)?\s*[- ]?\d{1,2}\s*[- ]?[A-D]\b/ig, " ")
    .replace(/\bB(CS|AI)\s*[- ]?\d{1,2}\s*[- ]?[A-D]\b/ig, " ")
    .replace(/\b(CS|AI)\s*[- ]?\d{1,2}\s*[- ]?[A-D]\b/ig, " ")
    .replace(/\bSECTION\s*[-:]?\s*[A-D]\b/ig, " ")
    .replace(/\bSEM(?:ESTER)?\s*[-:]?\s*\d{1,2}\b/ig, " ")
    .trim();
}

function findNearestTime(grid, row, col) {
  const rowSlot = normalizeTimeSlot((grid[row] || []).join(" "));
  if (rowSlot) return rowSlot;

  for (let rr = row - 1; rr >= Math.max(0, row - 12); rr--) {
    const slot = normalizeTimeSlot(cleanTxt((grid[rr] || [])[col]));
    if (slot) return slot;
  }

  const headerSlot = normalizeTimeSlot(collectHeaderContext(grid, row, col));
  return headerSlot;
}

function findNearestRoom(grid, row, col, cell) {
  let room = extractRoom(cell);
  if (room) return room;

  const rowVals = grid[row] || [];

  for (let cc = Math.max(0, col - 6); cc <= Math.min(rowVals.length - 1, col + 2); cc++) {
    room = extractRoom(rowVals[cc]);
    if (room) return room;
  }

  for (let rr = row - 1; rr >= Math.max(0, row - 15); rr--) {
    room = extractRoom((grid[rr] || [])[col]);
    if (room) return room;
  }

  room = extractRoom(collectHeaderContext(grid, row, col));
  return room;
}

function extractCourseFromTimetableCell(cell) {
  const cleaned = stripClassCodes(stripRoomAndTime(cell));
  const parts = String(cleaned).split(/\n|\r|;|\|/).map(cleanTxt).filter(Boolean);

  const ignored = /^(ROOM|VENUE|LAB|LECTURE|TUTORIAL|THEORY|PRACTICAL|TEACHER|INSTRUCTOR|FACULTY|CLASS|SECTION|TIME)$/i;
  const chosen = parts.find((p) => p.length > 2 && !ignored.test(p) && !normalizeTimeSlot(p));

  return chosen || "";
}

function parseMatrixRows(grid, tabName, target) {
  const day = normalizeDay(tabName);
  if (!day) return 0;

  let added = 0;

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];

    for (let c = 0; c < row.length; c++) {
      const cell = cleanTxt(row[c]);

      if (!cell || normalizeTimeSlot(cell)) continue;

      const time = findNearestTime(grid, r, c);
      if (!time) continue;

      const context = `${collectHeaderContext(grid, r, c)} ${row
        .slice(Math.max(0, c - 4), Math.min(row.length, c + 5))
        .join(" ")} ${cell}`;

      const meta = parseClassContext(context);
      const room = findNearestRoom(grid, r, c, cell);
      const course = extractCourseFromTimetableCell(cell);

      if (meta && room && course && addCourseToTT(target, { ...meta, day, time, room, course })) {
        added++;
      }
    }
  }

  return added;
}

function buildTTWithDiagnostics(sheets) {
  const next = {};
  const diagnostics = [];

  sheets.forEach(({ name, grid, error }) => {
    if (error) {
      diagnostics.push({ name, error, rows: 0, added: 0 });
      return;
    }

    const before = countTTEntries(next);
    const db = parseDatabaseRows(grid, name, next);
    const matrix = parseMatrixRows(grid, name, next);
    const after = countTTEntries(next);

    diagnostics.push({
      name,
      rows: grid.length,
      added: after - before,
      database: db,
      matrix
    });
  });

  Object.values(next).forEach((batches) =>
    Object.values(batches).forEach((sections) =>
      Object.values(sections).forEach((days) =>
        Object.values(days).forEach((arr) =>
          arr.sort((a, b) => slotToMinutes(a.t.split("-")[0]) - slotToMinutes(b.t.split("-")[0]))
        )
      )
    )
  );

  return { tt: next, diagnostics };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const requestedSheet = req.query && req.query.sheet;
    const tabs = requestedSheet ? [requestedSheet] : GOOGLE_SHEET_TABS;
    const uniqueTabs = [...new Set(tabs)];

    const sheets = [];

    for (const tab of uniqueTabs) {
      try {
        const grid = await loadSheetGrid(tab);
        sheets.push({ name: tab, grid });
      } catch (err) {
        sheets.push({
          name: tab,
          grid: [],
          error: err.message || String(err)
        });
      }
    }

    if (req.query && req.query.raw) {
      return res.status(200).json({
        ok: true,
        sheets: sheets.map((s) => ({
          name: s.name,
          error: s.error,
          rows: s.grid.length,
          preview: s.grid.slice(0, 20)
        }))
      });
    }

    const { tt, diagnostics } = buildTTWithDiagnostics(sheets);
    const count = countTTEntries(tt);

    if (!count) {
      return res.status(500).json({
        ok: false,
        error: "Parsed 0 classes from Google Sheet. Use /api/timetable?raw=1 to inspect the first 20 rows from each tab.",
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
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
};
