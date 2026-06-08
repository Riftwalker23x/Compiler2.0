// Vercel Serverless Function: /api/timetable
// Parses the Compiler Society timetable Google Sheet using the actual layout:
//   Rows 1-4  → Column-group headers (dept+batch per column group)
//   Row 5     → Time slot headers per column group
//   Rows 6-57 → Classroom rows (Col A = Room, course cells in slot columns)
//   Row 58    → Lab divider
//   Row 59+   → Lab rows (same structure, 3-hour slot widths)
//   ~Col AE   → Second "Room" column = evening section

const GOOGLE_SHEET_ID = "1ZQJqdArlwCS965uw4sbJrB6j8rEPfZerMT7X8qkXSzY";
const GOOGLE_SHEET_TABS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SECTION_PATTERN = /\(([A-Z]{2,3})-([A-Z0-9]{1,3})\)/;

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

function normKey(v) {
  return oneLine(v).toLowerCase().replace(/[^a-z0-9]+/g, "");
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

function slotToMinutes(slot) {
  const start = String(slot || "").split("-")[0] || "";
  const m = start.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 99999;
  return parseClock(m[1], m[2], "");
}

/* ── Room helpers ── */

function normalizeRoomName(room) {
  return oneLine(room).toUpperCase().replace(/\s+/g, " ");
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
   PHASE 1 — Build Column Map from Header Rows
   ══════════════════════════════════════════ */

function buildColRangesFromRow(row) {
  const ranges = [];
  let start = -1, slot = null;
  for (let c = 0; c < row.length; c++) {
    const cell = oneLine(row[c]);
    if (!cell) continue;
    const timeSlot = normalizeTimeSlot(cell);
    if (timeSlot) {
      if (start >= 0) ranges.push({ startCol: start, endCol: c - 1, slot });
      start = c;
      slot = timeSlot;
    }
  }
  if (start >= 0) ranges.push({ startCol: start, endCol: row.length - 1, slot });
  return ranges;
}

const BATCH_PATTERN = /BS\s+(CS|DS|AI|CY|SE)\s+\((\d{4})\)/i;

function buildBatchLayers(grid) {
  const layers = [];
  for (let r = 0; r < Math.min(4, grid.length); r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      const m = oneLine(row[c]).match(BATCH_PATTERN);
      if (!m) continue;
      const dept = m[1].toUpperCase();
      const batch = m[2];
      // Determine group end: look right until next label or gap
      let endCol = c;
      for (let cc = c + 1; cc < Math.min(c + 8, row.length); cc++) {
        const v = oneLine(row[cc]);
        if (!v && cc - c >= 4) break;
        if (v.match(BATCH_PATTERN) || /^room$/i.test(v)) break;
        endCol = cc;
      }
      layers.push({ colStart: c, colEnd: endCol, dept, batch });
    }
  }
  return layers;
}

/* ══════════════════════════════════════════
   PHASE 2 — Parse Cell Text
   ══════════════════════════════════════════ */

function parseCellText(cell) {
  const t = oneLine(cell);
  if (!t) return null;
  const sectionMatch = t.match(SECTION_PATTERN);
  if (!sectionMatch) return null;
  return {
    dept: sectionMatch[1].toUpperCase(),
    section: sectionMatch[2].toUpperCase(),
    courseName: t.split("(")[0].trim(),
    customTime: (t.match(/(\d{1,2}:\d{2}-\d{1,2}:\d{2})/) || [])[1] || null
  };
}

/* ══════════════════════════════════════════
   PHASE 3 — Map Section to Batch via Column
   ══════════════════════════════════════════ */

function getBatchForCol(colIndex, dept, batchLayers) {
  for (const l of batchLayers) {
    if (l.dept === dept && colIndex >= l.colStart && colIndex <= l.colEnd) return l.batch;
  }
  return null;
}

/* ══════════════════════════════════════════
   PHASE 4 — Detect Evening Section
   ══════════════════════════════════════════ */

function detectSections(headerRow) {
  const roomCols = [];
  for (let c = 0; c < headerRow.length; c++) {
    if (/^room$/i.test(oneLine(headerRow[c]))) roomCols.push(c);
  }
  const allRanges = buildColRangesFromRow(headerRow);
  if (roomCols.length < 2) {
    return {
      leftRanges: allRanges,
      leftRoomCol: roomCols[0] || 0,
      rightRanges: [],
      rightRoomCol: -1
    };
  }
  const splitCol = roomCols[1];
  return {
    leftRanges: allRanges.filter(r => r.startCol < splitCol),
    leftRoomCol: roomCols[0],
    rightRanges: allRanges.filter(r => r.startCol >= splitCol),
    rightRoomCol: splitCol
  };
}

/* ══════════════════════════════════════════
   PHASE 5 — Lab Section Detection
   ══════════════════════════════════════════ */

function findLabStart(grid) {
  // Lab header rows have a 3-hour time-span label in column B (e.g. "08:30-11:15")
  // Classroom rows have course names in column B, not bare time labels
  // Col A in a lab header is empty or "Room" — not a room code
  const labTimePattern = /^\d{1,2}:\d{2}-(?:1[0-5]|0\d):\d{2}$/;
  for (let r = 5; r < grid.length; r++) {
    const row = grid[r] || [];
    const colB = oneLine(row[1] || "");
    if (labTimePattern.test(colB)) {
      const colA = oneLine(row[0] || "").toLowerCase();
      // Header rows have few non-empty cells. Also colA should not be a room code.
      const nonEmpty = row.filter(c => oneLine(c)).length;
      if (nonEmpty <= 6 && (!colA || colA === 'room')) return r;
    }
  }
  return -1;
}

/* ══════════════════════════════════════════
   PHASE 6 — Skip Patterns
   ══════════════════════════════════════════ */

const SKIP_PATTERNS = [
  /^reserved/i, /^tutorial$/i, /^fsm$/i, /^fsa$/i, /^fcss$/i,
  /^fyp/i, /^travel/i, /^admin$/i, /^break$/i, /^lunch$/i,
  /^room$/i, /^(monday|tuesday|wednesday|thursday|friday)$/i,
  /^08:30-11:15$/, /^11:30-02:15$/, /^02:30-05:15$/, /^05:20-08:05$/,
  /^$/
];

function shouldSkip(cell) {
  const t = oneLine(cell).toLowerCase().replace(/[\s]+/g, " ").trim();
  if (!t) return true;
  return SKIP_PATTERNS.some(p => p.test(t));
}

function looksLikeRoomHeader(cell) {
  return /^(room|venue|location|class\s*room|lab\s*room)$/i.test(oneLine(cell));
}

/* ══════════════════════════════════════════
   PHASE 7 — Parse Data Rows
   ══════════════════════════════════════════ */

function parseRows({ grid, startRow, endRow, roomCol, colRanges, batchLayers, day, target }) {
  let added = 0;
  for (let r = startRow; r < Math.min(endRow, grid.length); r++) {
    const row = grid[r] || [];
    const roomCell = oneLine(row[roomCol] || "");
    if (!roomCell || shouldSkip(roomCell) || looksLikeRoomHeader(roomCell)) continue;

    const room = normalizeRoomName(roomCell);
    if (!room || room.length < 2) continue;

    for (const range of colRanges) {
      // Scan all columns in range, use first meaningful cell
      let cellContent = "";
      for (let c = range.startCol; c <= Math.min(range.endCol, row.length - 1); c++) {
        const v = oneLine(row[c] || "");
        if (v && !shouldSkip(v)) { cellContent = v; break; }
      }
      if (!cellContent) continue;

      const parsed = parseCellText(cellContent);
      if (!parsed) continue;

      const batch = getBatchForCol(range.startCol, parsed.dept, batchLayers);
      if (!batch) continue;

      const time = parsed.customTime || range.slot;
      if (!time) continue;

      const course = parsed.courseName;
      if (!course || course.length < 1) continue;

      if (addCourseToTT(target, {
        dept: parsed.dept,
        batch,
        section: parsed.section,
        day,
        course,
        room,
        time
      })) added++;
    }
  }
  return added;
}

/* ══════════════════════════════════════════
   Main Parsing Orchestrator
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
    const grid = sheet.grid;
    const day = normalizeDay(sheet.name);
    if (!day) continue;

    // Phase 1a: Build batch layers from header rows 1-4
    const batchLayers = buildBatchLayers(grid);

    // Phase 1b+4: Detect sections and build column ranges from row 5
    const headerRow = grid[4] || [];
    const { leftRanges, leftRoomCol, rightRanges, rightRoomCol } = detectSections(headerRow);

    // Phase 5: Find lab section
    const labStart = findLabStart(grid);
    const classroomEnd = labStart > 0 ? labStart : grid.length;

    // Parse left side (day classrooms, rows 6–57)
    parseRows({
      grid,
      startRow: 5,
      endRow: classroomEnd,
      roomCol: leftRoomCol,
      colRanges: leftRanges,
      batchLayers,
      day,
      target: tt
    });

    // Parse right side (evening section) if present
    if (rightRanges.length > 0 && rightRoomCol >= 0) {
      parseRows({
        grid,
        startRow: 5,
        endRow: classroomEnd,
        roomCol: rightRoomCol,
        colRanges: rightRanges,
        batchLayers,
        day,
        target: tt
      });
    }

    // Parse lab section (rows after lab divider)
    if (labStart > 0) {
      const labHeaderRow = grid[labStart] || [];
      const labRanges = buildColRangesFromRow(labHeaderRow);

      if (labRanges.length > 0) {
        // Parse left side labs
        parseRows({
          grid,
          startRow: labStart + 1,
          endRow: grid.length,
          roomCol: leftRoomCol,
          colRanges: labRanges,
          batchLayers,
          day,
          target: tt
        });

        // Parse right side evening labs
        if (rightRanges.length > 0 && rightRoomCol >= 0) {
          parseRows({
            grid,
            startRow: labStart + 1,
            endRow: grid.length,
            roomCol: rightRoomCol,
            colRanges: labRanges.filter(r => r.startCol >= rightRoomCol),
            batchLayers,
            day,
            target: tt
          });
        }
      }
    }

    const after = countTTEntries(tt);
    diagnostics.push({
      name: sheet.name,
      rows: grid.length,
      cols: Math.max(0, ...grid.map((r) => r.length)),
      added: after - before,
      sections: {
        leftRanges: leftRanges.length,
        rightRanges: rightRanges.length,
        labStart,
        batchLayers: batchLayers.length
      },
      samples: nonEmptySamples(grid, 12)
    });
  }

  // Sort entries by time
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
        error: "Parsed 0 classes from Google Sheet. The parser does not match the sheet layout yet. Open /api/timetable?raw=1 and send the JSON preview to debug.",
        diagnostics
      });
    }

    return res.status(200).json({
      ok: true,
      count,
      slots: [...SLOTS],
      tt,
      diagnostics,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
