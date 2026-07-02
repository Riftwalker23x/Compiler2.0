#!/usr/bin/env python3

"""
Generate timetable JSON from Google Sheets using Sheets API v4.
Reads cell background colors to determine batch/year for each entry.

Setup:
  1. pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
  2. Go to https://console.cloud.google.com → create project → enable Google Sheets API
  3. Create a service account → download JSON key → save as service-account.json
  4. Share each sheet with the service account email (viewer)
  5. Run: python generate_timetable.py --discover
     → prints all unique non-white background colours found in each sheet
     → copy the printed COLOUR_BATCH_MAP entries into this file
  6. Run: python generate_timetable.py
     → generates db/timetable-{school}.json for each school

Output: db/timetable-{school}.json  (one file per school)
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from collections import OrderedDict

from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
SERVICE_ACCOUNT_FILE = "service-account.json"
DEBUG_LOG_FILE = "debugLog.txt"

# ---------------------------------------------------------------------------
# Debug logger
# ---------------------------------------------------------------------------

_debug_lines = []

def dlog(msg, level="INFO"):
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] [{level}] {msg}"
    _debug_lines.append(line)
    print(line)

def dlog_error(msg):
    dlog(msg, level="ERROR")

def dlog_warn(msg):
    dlog(msg, level="WARN")

def flush_debug_log():
    with open(DEBUG_LOG_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(_debug_lines) + "\n")
    print(f"\nDebug log written to: {DEBUG_LOG_FILE}")

SCHOOLS = OrderedDict([
    ("computing", OrderedDict([
        ("id", "1ZQJqdArlwCS965uw4sbJrB6j8rEPfZerMT7X8qkXSzY"),
        ("tabs", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
    ])),
    ("business", OrderedDict([
        ("id", "1m5yFyi0QgWx0JhdEicQQL2JOEpSmcmVDOIi15_4p9Dw"),
        ("tabs", ["Timetable"]),
    ])),
    ("engineering", OrderedDict([
        ("id", "1S3mWYvoM7HbIeiqAbt65FngdmYDUA8MWOQSjcUYsFXU"),
        ("tabs", ["Classes Schedule FSE SP-26"]),
    ])),
])

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# ---------------------------------------------------------------------------
# COLOUR_BATCH_MAP
#
# Auto-populated at runtime by build_colour_map().
# No manual editing needed — the script reads header cells like
# 'BS CS (2025)' or 'MS (CS)' to infer which colour = which batch.
# ---------------------------------------------------------------------------

COLOUR_BATCH_MAP = {}  # filled automatically at runtime

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BATCH_MAP = {"25": "2025", "24": "2024", "23": "2023", "22": "2022"}
COMPUTING_PROGRAM_CODES = {"AI", "CS", "CY", "DS", "SE"}

CELL_RE = re.compile(
    r"(.+?)\s*\(([A-Z]+(?:\s*[/,]\s*(?!GP?\b)[A-Z]+)*)(?:-([A-Z]+)(\d+)?)?"
    r"(?:,\s*(?:Gp?-([IV]+)|(\d{2})))?\s*\)",
    re.IGNORECASE
)

SLOT_COLS = {
    1: "08:30-09:50", 6: "10:00-11:20", 11: "11:30-12:50",
    16: "01:00-02:20", 21: "02:30-03:50", 26: "03:55-05:15",
    31: "05:20-06:40", 36: "06:45-08:05"
}

CLASSROOM_LEFT = {
    "room_col": 0, "end_col": 30,
    "slot_cols": [1, 6, 11, 16, 21, 26],
    "slot_map": {
        1: "08:30-09:50", 6: "10:00-11:20", 11: "11:30-12:50",
        16: "01:00-02:20", 21: "02:30-03:50", 26: "03:55-05:15"
    }
}
CLASSROOM_RIGHT = {
    "room_col": 30, "end_col": None,
    "slot_cols": [31, 36],
    "slot_map": {31: "05:20-06:40", 36: "06:45-08:05"}
}
LAB_BLOCK = {
    "room_col": 0, "end_col": None,
    "slot_cols": [1, 11, 21, 31],
    "slot_map": {
        1: "08:30-11:15", 11: "11:30-02:15",
        21: "02:30-05:15", 31: "05:20-08:05"
    }
}

# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def clean(v):
    return str(v or "").replace("\u00a0", " ").strip()

def one_line(v):
    return re.sub(r"\s+", " ", clean(v))

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------

def rgb_key(bg):
    """
    Convert a Sheets API backgroundColor dict to a rounded (R, G, B) tuple.
    Values are floats in [0, 1]. We round to 2 decimal places so that
    trivial float precision differences don't break dict lookups.
    Returns None if bg is falsy.
    """
    if not bg:
        return None
    r = round(bg.get("red",   0.0), 2)
    g = round(bg.get("green", 0.0), 2)
    b = round(bg.get("blue",  0.0), 2)
    return (r, g, b)

def is_white(colour):
    """True for white / near-white cells (no meaningful background colour)."""
    if colour is None:
        return True
    r, g, b = colour
    return r >= 0.95 and g >= 0.95 and b >= 0.95

def colour_to_batch(colour):
    """
    Look up a colour tuple in COLOUR_BATCH_MAP.
    Returns a year string like "2025", or None if not found / white.
    """
    if colour is None or is_white(colour):
        return None
    return COLOUR_BATCH_MAP.get(colour)

def extract_dept_from_header(header_text):
    """
    Extract department prefix from a column header like:
      'BS CS (2025)' -> 'BS CS'
      'BS AI (2023)' -> 'BS AI'
      'MS (CS)' -> 'MS (CS)'
      'PhD' -> 'PhD'
    
    Returns the department prefix, or None if can't extract.
    """
    if not header_text:
        return None
    
    text = one_line(header_text).strip()
    if not text:
        return None

    text = re.sub(r"\s+", " ", text)
    
    # Pattern 1: Degree + code + optional year.
    # Handles both spaced and compact sheet labels, e.g. "BS CS (2025)" and "BSCS (2025)".
    m = re.match(r'^(BS|FT|BA|BBA|AF)\s*([A-Za-z][A-Za-z& ]*?)\s*(?:\(\d{4}\))?$', text, re.IGNORECASE)
    if m:
        prefix = m.group(1).upper()
        code = m.group(2).strip()
        code = code.upper() if code.isupper() or len(code) <= 3 else code
        return f"{prefix} {code}"
    
    # Pattern 2: MS with code in parens  e.g. "MS (CS)", "MS (DS)"
    m = re.match(r'^MS\s*\(([A-Za-z]+)\)\s*(?:\(\d{4}\))?$', text, re.IGNORECASE)
    if m:
        code = m.group(1).upper()
        return f"MS ({code})"
    
    # Pattern 3: MS with plain/compact code  e.g. "MS CS", "MSCS"
    m = re.match(r'^MS\s*([A-Za-z]{2,4})\s*(?:\(\d{4}\))?$', text, re.IGNORECASE)
    if m:
        code = m.group(1).upper()
        return f"MS ({code})"
    
    # Pattern 4: Just single word degree  e.g. "PhD", "G"
    if re.match(r'^(PhD|G)$', text, re.IGNORECASE):
        return text.upper()
    
    # Debug: return the text itself if it looks like a degree label but didn't match
    if any(text.upper().startswith(p) for p in ['BS', 'MS', 'PhD', 'G', 'FT', 'BA', 'BBA', 'AF']):
        # Might be a malformed header, try to extract what we can
        words = text.split()
        if len(words) >= 1:
            return text  # Return as-is if it starts with a known prefix
    
    return None

def normalize_dept_key(dept_code):
    """
    Normalize unknown department codes (fallback for business school FSM parser).
    If no prefix found, prepend 'BS'.
    
    Examples:
      'CS' -> 'BS CS'
      'Unknown' -> 'BS Unknown'
    """
    if not dept_code:
        return 'BS'
    
    dept_code = str(dept_code).strip()
    
    # Check if already has a known prefix
    known_prefixes = ('BS', 'MS', 'G', 'FT', 'BA', 'BBA', 'AF', 'PhD')
    for prefix in known_prefixes:
        if dept_code.startswith(prefix + ' ') or dept_code == prefix:
            return dept_code
    
    # No prefix found, add BS
    return f'BS {dept_code}'

# ---------------------------------------------------------------------------
# Sheets API fetch — returns BOTH text grid and colour grid in one call
# ---------------------------------------------------------------------------

def get_sheet_tab_names(service, spreadsheet_id):
    """Return the list of actual tab/sheet names in a spreadsheet."""
    try:
        meta = service.spreadsheets().get(
            spreadsheetId=spreadsheet_id,
            fields="sheets.properties(title,index)"
        ).execute()
        return [s["properties"]["title"] for s in meta.get("sheets", [])]
    except Exception as e:
        dlog_error(f"Could not fetch tab names for {spreadsheet_id}: {e}")
        return []

def fetch_sheet_with_colours(service, spreadsheet_id, tab):
    """
    Fetch a full sheet tab using two lightweight API calls:

      1. spreadsheets.values.get()  — returns formatted cell text only.
         Very small response; never triggers the amplification-ratio limit.

      2. spreadsheets.get() with includeGridData=True BUT scoped to the
         exact bounding rectangle reported by call 1.  Because we request
         only the cells that actually contain data, the response stays well
         within Google's 100× amplification-ratio limit even for large sheets
         like the Business / FSM 'Timetable' tab.

    Returns:
        text_grid   — list of rows, each row a list of strings
        colour_grid — list of rows, each row a list of (R,G,B) tuples or None
    Both grids have the same dimensions.
    """
    dlog(f"Fetching spreadsheet={spreadsheet_id} tab='{tab}'")

    # ── Call 1: text only ────────────────────────────────────────────────────
    values_result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{tab}'",
        valueRenderOption="FORMATTED_VALUE",
    ).execute()

    raw_rows = values_result.get("values", [])
    if not raw_rows:
        return [], []

    num_rows = len(raw_rows)
    num_cols = max(len(r) for r in raw_rows)

    # Build a rectangular text grid from the values response
    text_grid = []
    for r in raw_rows:
        padded = [clean(v) for v in r] + [""] * (num_cols - len(r))
        text_grid.append(padded)

    # ── Call 2: colours only, bounded to actual data range ───────────────────
    # Convert column count to an A1-notation letter so the range is explicit.
    def col_to_letter(n):          # n is 1-based column count
        letters = ""
        while n:
            n, rem = divmod(n - 1, 26)
            letters = chr(65 + rem) + letters
        return letters

    end_col_letter = col_to_letter(num_cols)
    bounded_range  = f"'{tab}'!A1:{end_col_letter}{num_rows}"

    colour_result = service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        ranges=[bounded_range],
        fields=(
            "sheets.data.rowData.values("
            "effectiveFormat.backgroundColor"
            ")"
        ),
        includeGridData=True,
    ).execute()

    sheets_data = colour_result.get("sheets", [])
    colour_rows = (
        sheets_data[0].get("data", [{}])[0].get("rowData", [])
        if sheets_data else []
    )

    # Build a rectangular colour grid aligned to text_grid dimensions
    colour_grid = []
    for r in range(num_rows):
        colour_row = []
        cells = colour_rows[r].get("values", []) if r < len(colour_rows) else []
        for c in range(num_cols):
            if c < len(cells):
                bg = cells[c].get("effectiveFormat", {}).get("backgroundColor")
                colour_row.append(rgb_key(bg))
            else:
                colour_row.append(None)
        colour_grid.append(colour_row)

    return text_grid, colour_grid

# ---------------------------------------------------------------------------
# Cell parsing
# ---------------------------------------------------------------------------

def parse_timetable_cell(text):
    if not text:
        return None
    t = one_line(text)
    paren = t.find(")")
    core = t[:paren + 1] if paren >= 0 else t
    m = CELL_RE.match(core)
    if not m:
        return None
    course  = m.group(1).strip()
    dept_str = m.group(2)
    section  = m.group(3)
    subgroup = m.group(4)
    group = m.group(5)
    depts = [d.strip().upper() for d in re.split(r"\s*[/,]\s*", dept_str) if d.strip()]
    if not depts:
        return None
    if not section and group:
        section = f"G-{group.upper()}"
    if subgroup:
        # Label with the actual section letter + subgroup digit (e.g. "G1", "B1")
        # instead of a generic "Gp 1" that's indistinguishable across sections.
        sub_label = f"{section}{subgroup}" if section else f"Gp {subgroup}"
        course = f"{course} ({sub_label})"
    return {
        "course": course,
        "depts": depts,
        "section": section,
        "has_section": bool(section),
    }

def is_ms_context(batch, dept):
    return batch == "MS" or str(dept or "").startswith("MS")

def resolve_departments_for_cell(parsed, header_dept, batch):
    """
    Decide whether a parsed code like DS means BS DS or MS (DS).

    BS cells include explicit sections like (DS-A). MS timetable cells often omit
    sections and use forms like (DS), (SE), or comma-separated electives.

    IMPORTANT: for the computing-school matrix, the "BS CS (2025)" / "BS DS (2025)"
    / etc. rows above the Room/time header are only a colour LEGEND used to map
    background colour -> batch year (see build_colour_map / COLOUR_BATCH_MAP).
    They are NOT reliably aligned to department per column — a cell physically
    sitting under the "BS AI (2025)" legend can still legitimately contain
    "Civics (CS-G)". So whenever the cell text itself encodes a department
    (e.g. "(CS-G)"), that must win over the column's header_dept. header_dept
    is only used as a fallback when the cell doesn't specify a department at all.
    """
    parsed_depts = parsed["depts"]
    if is_ms_context(batch, header_dept) and (
            not parsed["has_section"] or is_ms_context(batch, header_dept)):
        ms_depts = [f"MS ({dept})" for dept in parsed_depts if dept in COMPUTING_PROGRAM_CODES]
        if ms_depts:
            return ms_depts
        if header_dept and is_ms_context(batch, header_dept):
            return [header_dept]
        return []
    # Prefer the department encoded directly in the cell text over the
    # column's positional header — the cell is the source of truth.
    if parsed_depts:
        return [normalize_dept_key(dept) for dept in parsed_depts]
    if header_dept:
        return [header_dept]
    return []

# ---------------------------------------------------------------------------
# Batch inference (fallback only — used when cell has no mapped colour)
# ---------------------------------------------------------------------------

def infer_batch_from_course(course_name):
    name = (course_name or "").upper()
    if re.search(
        r"\b(CAPSTONE|FYP|SENIOR\s+PROJECT|FINAL\s+YEAR\s+PROJECT|"
        r"TECH\s+STARTUP|TECH\s+ENTREPRENEURSHIP|INNOVATION\s+LAB|"
        r"RESEARCH\s+METHODS|AI\s+ETHICS|DIGITAL\s+FORENSICS|"
        r"ETHICAL\s+HACK|MALWARE|BIG\s+DATA|BDA|AUTONOMOUS\s+VEHICLES|"
        r"ROBOTICS|IOT|PROFESSIONAL\s+ETHICS|BUSINESS\s+COMMUNICATION|"
        r"ENTRE|TECH\s+MGT|COMP\s+VISION|COMPUTER\s+VISION)\b", name):
        return "2022"
    if re.search(
        r"\b(COMPILER|COMP\s+CONST|PDC|PARALLEL|"
        r"ARTIFICIAL\s+INTELLIGENCE|\bAI\b|MACHINE\s+LEARNING|\bML\b|"
        r"DEEP\s+LEARN|DEEP\s+LEARNING|COMPUTER\s+NETWORKS|\bCN\b|"
        r"COMP\s+NET|SOFTWARE\s+ENGINEERING|\bSE\b|SPM|"
        r"PROJECT\s+MANAGEMENT|INFO\s+SEC|INFORMATION\s+SECURITY|PPIT|"
        r"PROFESSIONAL\s+PRACTICES|IMAGE\s+PROCESSING|\bDIP\b|"
        r"NATURAL\s+LANGUAGE|NLP|CLOUD\s+COMP|METRIC|GEN\s+AI|"
        r"GENERATIVE\s+AI|PRODUCT\s+DEV|GAME\s+DEV|MOBILE\s+APP|"
        r"STAT\s+MODELING|DIGITAL\s+MKTG|FIN\s+MGT)\b", name):
        return "2023"
    if re.search(
        r"\b(DATA\s+ST|DATA\s+STRUCTURES|OPERATING\s+SYSTEMS|\bOS\b|"
        r"DATABASE|\bDB\b|REQUIREMENTS|SRE|DESIGN\s+&\s+ARCHITECTURE|"
        r"SDA|COMPUTER\s+ORGANIZATION|COAL|PROBABILITY|PROB\s+&\s+STATS|"
        r"STATS\s+FOR\s+ML|LINEAR\s+ALGEBRA|DATA\s+ANALYSIS)\b", name):
        return "2024"
    if re.search(
        r"\b(OBJECT|OOP|DISCRETE|DIGITAL\s+LOGIC|DLD|MULTIVARIABLE|"
        r"MV\s+CALCULUS|APPLIED\s+PHYSICS|\bAP\b|PAK\s+STUDIES|"
        r"PAKISTAN|FUNCTIONAL\s+ENGLISH|EXP\s+WRITING|EXPOSITORY|"
        r"SEERAH|ISLAMIC|CIVICS|PROGRAMMING|\bPF\b|"
        r"INTRO\s+TO\s+COMPUTING|ITC|CALCULUS|COMPOSITION)\b", name):
        return "2025"
    return None

def resolve_batch(cell_colour, cell_text, course_name):
    """
    Three-tier batch resolution for a single data cell:

    1. Explicit year suffix in cell text:  "(CS-A, 25)"  → "2025"
       Most reliable — directly encoded in the cell.

    2. Cell background colour → COLOUR_BATCH_MAP lookup
       Reliable once COLOUR_BATCH_MAP is filled in from --discover output.
       This is THE primary mechanism for the computing school matrix format.

    3. Course-name inference (last resort)
       Fragile — only works for courses with distinctive names.
       Falls back to "2023" if nothing matches.
    """
    # Tier 1 — explicit suffix
    m = re.search(r",\s*(\d{2})\s*\)", cell_text)
    if m:
        short = m.group(1)
        return BATCH_MAP.get(short, "20" + short)

    # Tier 2 — colour lookup
    batch = colour_to_batch(cell_colour)
    if batch:
        return batch

    # Tier 3 — course name inference, with "2023" as final default
    return infer_batch_from_course(course_name) or "2023"

# ---------------------------------------------------------------------------
# Room normalisation
# ---------------------------------------------------------------------------

def normalise_room(room):
    r = one_line(room).upper()
    r = re.sub(r"\s+", " ", r)
    r = re.sub(r"-{2,}", "-", r)
    r = re.sub(r"\b([A-D])\s+(\d{3})\b", r"\1-\2", r)
    m = re.match(
        r"([A-D])\s*-\s*(\d{3}|IT\s*LAB\s*\d+|MARGALA\s*\d*|"
        r"RAWAL\s*\d*|GPU\s*LAB|MEHRAN\s*\d*|CALL-\d+|DIGITAL\b)", r)
    if m:
        return f"{m.group(1).upper()}-{m.group(2).strip()}"
    return r

# ---------------------------------------------------------------------------
# Timetable accumulator
# ---------------------------------------------------------------------------

def add_course(tt, dept, batch, section, day, course, room, time):
    if not all([dept, batch, section, day, course, room, time]):
        return False
    depts = dept if isinstance(dept, list) else [dept]
    added = False
    for d in depts:
        tt.setdefault(d, {})
        tt[d].setdefault(batch, {})
        tt[d][batch].setdefault(section, {})
        tt[d][batch][section].setdefault(day, [])
        arr = tt[d][batch][section][day]
        if not any(x["c"] == course and x["l"] == room and x["t"] == time for x in arr):
            arr.append({"c": course, "l": room, "t": time})
            added = True
    return added

# ---------------------------------------------------------------------------
# Sheet structure helpers
# ---------------------------------------------------------------------------

def find_header_row(text_grid):
    for r in range(min(len(text_grid), 10)):
        cell = one_line(text_grid[r][0] if text_grid[r] else "")
        if "room" in cell.lower():
            slots_found = sum(
                1 for c_idx in SLOT_COLS
                if c_idx < len(text_grid[r]) and re.match(r"\d{1,2}:\d{2}", one_line(text_grid[r][c_idx] or ""))
            )
            if slots_found >= 4:
                return r
    return -1

def find_lab_header_row(text_grid, after_row):
    for r in range(after_row, len(text_grid)):
        col_a = one_line(text_grid[r][0] if text_grid[r] else "").lower()
        if "lab" in col_a:
            return r
        if len(text_grid[r]) > 1:
            col_b = one_line(text_grid[r][1] or "")
            if re.match(r"^\d{1,2}:\d{2}-(?:1[0-5]|0\d|2[0-3]):\d{2}$", col_b):
                if sum(1 for c in text_grid[r] if one_line(c)) <= 6:
                    return r
    return -1

def build_col_dept_map(header_rows):
    """
    Build a mapping from column index to department prefix string.
    
    From header rows like:
      [Room, BS CS (2025), BS CS (2025), ..., MS (CS), MS (CS), ...]
    
    Extract and store the department string for each column (after the room column).
    Fills merged-cell gaps so that columns between headers inherit from the last header.
    """
    col_dept = {}

    if not header_rows:
        return col_dept
    if header_rows and not isinstance(header_rows[0], list):
        header_rows = [header_rows]

    max_cols = max((len(row) for row in header_rows), default=0)

    for row in header_rows:
        dept_starts = []
        for col, header_text in enumerate(row):
            dept = extract_dept_from_header(header_text)
            if dept:
                dept_starts.append((col, dept))

        for idx, (start_col, dept) in enumerate(dept_starts):
            end_col = dept_starts[idx + 1][0] if idx + 1 < len(dept_starts) else max_cols
            for col in range(max(1, start_col), end_col):
                col_dept[col] = dept
    
    return col_dept

# ---------------------------------------------------------------------------
# Matrix block parser — now receives both text_grid and colour_grid
# ---------------------------------------------------------------------------

def parse_matrix_block(text_grid, colour_grid, start_row, end_row, block, day, tt, col_dept_map=None):
    """
    Parse one rectangular block of the computing school matrix.

    For each data cell:
      - text comes from text_grid[r][col]
      - background colour comes from colour_grid[r][col]
      - batch is resolved via resolve_batch(colour, text, course_name)
      - department comes from the header column via col_dept_map (if available)
    """
    if col_dept_map is None:
        col_dept_map = {}
    
    added = 0
    for r in range(start_row, min(end_row, len(text_grid))):
        row = text_grid[r]
        if not row:
            continue
        room = normalise_room(one_line(row[block["room_col"]] if len(row) > block["room_col"] else ""))
        if (not room or len(room) < 2 or
                re.search(r"reserved|tutorial|fsm|fsa|fcss|fyp|travel|admin|room",
                          room, re.IGNORECASE)):
            continue

        sc = block["slot_cols"]
        for i in range(len(sc)):
            time_col = sc[i]
            next_col = sc[i + 1] if i + 1 < len(sc) else block.get("end_col") or len(row)
            scan_end = min(next_col, len(row)) if next_col else len(row)

            for col in range(time_col, scan_end):
                cell_text = one_line(row[col] if col < len(row) else "")
                if not cell_text:
                    continue
                parsed = parse_timetable_cell(cell_text)
                if not parsed:
                    continue

                # Pull this cell's background colour from colour_grid
                cell_colour = None
                if r < len(colour_grid) and col < len(colour_grid[r]):
                    cell_colour = colour_grid[r][col]

                batch = resolve_batch(cell_colour, cell_text, parsed["course"])
                if not batch:
                    continue

                header_dept = col_dept_map.get(col)
                depts_to_add = resolve_departments_for_cell(parsed, header_dept, batch)
                section = parsed["section"]
                if not section and any(is_ms_context(batch, dept) for dept in depts_to_add):
                    section = "A"
                if not section:
                    continue
                
                for dept_key in depts_to_add:
                    if add_course(tt, dept_key, batch, section,
                                  day, parsed["course"], room,
                                  block["slot_map"][time_col]):
                        added += 1
                break  # found the cell for this slot, move to next slot

    return added

def parse_grid_to_tt(text_grid, colour_grid, day, tt):
    hr = find_header_row(text_grid)
    if hr < 0:
        return 0
    lr = find_lab_header_row(text_grid, hr + 1)
    classroom_end = lr if lr > 0 else len(text_grid)
    
    # Department labels are usually merged cells in the rows above the Room/time header.
    dept_header_rows = text_grid[max(0, hr - 3):hr + 1]
    col_dept_map = build_col_dept_map(dept_header_rows)
    
    added = 0
    added += parse_matrix_block(text_grid, colour_grid, hr + 1, classroom_end, CLASSROOM_LEFT,  day, tt, col_dept_map)
    added += parse_matrix_block(text_grid, colour_grid, hr + 1, classroom_end, CLASSROOM_RIGHT, day, tt, col_dept_map)
    if lr > 0:
        added += parse_matrix_block(text_grid, colour_grid, lr + 1, len(text_grid), LAB_BLOCK, day, tt, col_dept_map)
    return added

# ---------------------------------------------------------------------------
# FSM / Business School Parser  (paired-matrix format)
# ---------------------------------------------------------------------------

FSM_SLOT_STARTS = [3, 12, 21, 30, 39, 48]
FSM_SECTION_OFFSET = 7

FSM_COURSE_RE = re.compile(r'^([A-Za-z]{2,4}\s?\d{4,5})\s*')

FSM_TIME_OVERRIDE_RE = re.compile(
    r'\((\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)\)\s*$', re.IGNORECASE)

FSM_SECTION_RE = re.compile(r'^([A-Z]{2,5})(\d{2})([A-Z])(\d)?$')

FSM_COMBINED_RE = re.compile(r'^([A-Z]{2,5}\d{2})\s*([A-Z](?:\s*[/&]\s*[A-Z])+)$')

FSM_DAY_RE = re.compile(r'^(Monday|Tuesday|Wednesday|Thursday|Friday)$', re.IGNORECASE)

FSM_PROGRAM_MAP = {
    "FT": "BS Fintech",
    "BSFT": "BS Fintech",
    "BA": "BS Business Analytics",
    "BSBA": "BS Business Analytics",
    "BBA": "BS Business Administration",
    "AF": "BS Accounting & Finance",
}


def parse_fsm_course_name(raw):
    raw = one_line(raw or "")
    if not raw:
        return None, None, None

    time_override = None
    tm = FSM_TIME_OVERRIDE_RE.search(raw)
    if tm:
        time_override = tm.group(1)
        raw = raw[:tm.start()].strip()

    code = None
    title = raw
    cm = FSM_COURSE_RE.match(raw)
    if cm:
        code = cm.group(1).replace(" ", "")
        title = raw[cm.end():].strip()

    return code, title, time_override


def parse_fsm_section_code(raw):
    raw = one_line(raw or "").upper().replace(" ", "")
    if not raw:
        return None

    combo = FSM_COMBINED_RE.match(raw)
    if combo:
        base = combo.group(1)
        letters_str = re.sub(r'[/&]', ' ', combo.group(2))
        letters = letters_str.strip().split()
        results = []
        for i, l in enumerate(letters):
            code = base if i == 0 else base[:-1] + l
            m = FSM_SECTION_RE.match(code)
            if m:
                results.append({
                    "program": m.group(1),
                    "semester": m.group(2),
                    "section": m.group(3),
                    "sub_section": m.group(4) or None,
                    "full": code,
                })
        return results if results else None

    m = FSM_SECTION_RE.match(raw)
    if m:
        return [{
            "program": m.group(1),
            "semester": m.group(2),
            "section": m.group(3),
            "sub_section": m.group(4) or None,
            "full": raw,
        }]
    return None


def fsm_semester_to_batch(semester):
    try:
        sem = int(semester)
    except (ValueError, TypeError):
        return None
    current_year = 2026
    return str(current_year - sem // 2)


def parse_business_grid(text_grid, day, tt):
    added = 0

    # Find header row
    header_row = -1
    for r in range(min(len(text_grid), 5)):
        cell = one_line(text_grid[r][2] if len(text_grid[r]) > 2 else "")
        if "room" in cell.lower():
            slot_count = 0
            for sc in FSM_SLOT_STARTS:
                if sc < len(text_grid[r]):
                    if re.match(r'\d{1,2}:\d{2}', one_line(text_grid[r][sc] or "")):
                        slot_count += 1
            if slot_count >= 3:
                header_row = r
                break
    if header_row < 0:
        return 0

    # Detect time labels from header row
    header_times = {}
    for sc in FSM_SLOT_STARTS:
        if sc < len(text_grid[header_row]):
            raw = one_line(text_grid[header_row][sc] or "")
            m = re.match(r'(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})', raw)
            if m:
                header_times[sc] = raw
    if len(header_times) < 3:
        return 0

    # Walk data rows
    current_day = day
    current_type = "Classes"
    processed_keys = set()

    for r in range(header_row + 1, len(text_grid)):
        row = text_grid[r]
        if not row:
            continue

        day_cell = one_line(row[0] if len(row) > 0 else "")
        day_m = FSM_DAY_RE.match(day_cell)
        if day_m:
            current_day = day_m.group(1)

        type_cell = one_line(row[1] if len(row) > 1 else "")
        if type_cell in ("Classes", "Labs"):
            current_type = type_cell

        raw_room = one_line(row[2] if len(row) > 2 else "")
        if not raw_room or len(raw_room) < 2:
            continue
        room = normalise_room(raw_room)
        if re.search(r"reserved|tutorial|fsm|fsa|fcss|fyp|travel|admin|room", room, re.IGNORECASE):
            continue
        if len(room) < 2:
            continue

        # Skip labs header rows
        if current_type == "Labs" and type_cell == "Labs" and not raw_room:
            continue

        slot_starts = sorted(header_times.keys())
        for si, sc in enumerate(slot_starts):
            time = header_times[sc]
            s_end = slot_starts[si + 1] if si + 1 < len(slot_starts) else sc + 9
            section_col = sc + FSM_SECTION_OFFSET

            course_raw = one_line(row[sc] if sc < len(row) else "")
            if not course_raw:
                continue

            course_code, course_title, time_override = parse_fsm_course_name(course_raw)
            if not course_title:
                continue

            # Find section code
            section_raw = ""
            for c in range(section_col, min(s_end, len(row))):
                cell = one_line(row[c] or "")
                if cell:
                    section_raw = cell
                    break
            if not section_raw:
                continue

            # Skip non-section entries
            if len(section_raw) < 4 and not re.search(r'\d', section_raw):
                continue

            parsed_sections = parse_fsm_section_code(section_raw)
            if not parsed_sections:
                continue

            course_label = f"{course_title} ({course_code})" if course_code else course_title
            effective_time = time_override if time_override else time

            for ps in parsed_sections:
                dept = FSM_PROGRAM_MAP.get(ps["program"])
                if not dept:
                    dept = normalize_dept_key(ps["program"])
                batch = fsm_semester_to_batch(ps["semester"])
                if not batch:
                    batch = "2025"

                sec = ps["section"]

                dedup_key = f"{dept}|{batch}|{sec}|{current_day}|{course_label}|{room}|{effective_time}"
                if dedup_key in processed_keys:
                    continue
                processed_keys.add(dedup_key)

                if add_course(tt, dept, batch, sec, current_day, course_label, room, effective_time):
                    added += 1

    return added


# ---------------------------------------------------------------------------
# Auto colour map builder
# ---------------------------------------------------------------------------

def build_colour_map(service):
    """
    Scan all sheets and auto-populate COLOUR_BATCH_MAP by parsing year from
    header cells like 'BS CS (2025)', 'BS AI (2022)', 'MS (CS)', etc.
    Only needs to scan the first few rows where headers live.
    """
    year_re = re.compile(r'\b(20\d{2})\b')
    ms_re   = re.compile(r'\bMS\b', re.IGNORECASE)

    for school_name, school_info in SCHOOLS.items():
        for tab in school_info["tabs"]:
            try:
                text_grid, colour_grid = fetch_sheet_with_colours(
                    service, school_info["id"], tab)
            except Exception:
                continue

            # Only scan first 10 rows — headers are always at the top
            for r, (t_row, c_row) in enumerate(zip(text_grid[:10], colour_grid[:10])):
                for text, colour in zip(t_row, c_row):
                    if colour is None or is_white(colour):
                        continue
                    if colour in COLOUR_BATCH_MAP:
                        continue  # already mapped

                    m = year_re.search(text)
                    if m:
                        COLOUR_BATCH_MAP[colour] = m.group(1)
                        continue

                    # MS header with no year e.g. 'MS (CS)', 'MS (DS)'
                    if ms_re.search(text) and 'BS' not in text.upper():
                        COLOUR_BATCH_MAP[colour] = "MS"

    print(f"  Auto-mapped {len(COLOUR_BATCH_MAP)} colours: "
          + ", ".join(sorted(set(COLOUR_BATCH_MAP.values()))))

# ---------------------------------------------------------------------------
# Colour discovery  (--discover mode)
# ---------------------------------------------------------------------------

def discover_colours(service):
    """
    Scan all sheets and print every unique non-white background colour found,
    with the nearest cell text so you can identify which batch it belongs to.
    Run once, then fill in COLOUR_BATCH_MAP from the output.
    """
    print("\n" + "=" * 60)
    print("COLOUR DISCOVERY MODE")
    print("=" * 60)
    print("Scanning all sheets for non-white background colours...\n")

    all_colours = {}  # colour_tuple → list of (school, tab, row, col, text)

    for school_name, school_info in SCHOOLS.items():
        print(f"  [{school_name}]")
        for tab in school_info["tabs"]:
            print(f"    Fetching {tab}...", end=" ", flush=True)
            try:
                text_grid, colour_grid = fetch_sheet_with_colours(
                    service, school_info["id"], tab)
            except Exception as e:
                print(f"ERROR: {e}")
                continue

            found = 0
            for r, (t_row, c_row) in enumerate(zip(text_grid, colour_grid)):
                for col, (text, colour) in enumerate(zip(t_row, c_row)):
                    if colour is None or is_white(colour):
                        continue
                    snippet = one_line(text)[:60] if text else ""
                    if colour not in all_colours:
                        all_colours[colour] = []
                    all_colours[colour].append((school_name, tab, r, col, snippet))
                    found += 1
            print(f"{found} coloured cells")

    if not all_colours:
        print("\n[!] No non-white coloured cells found across any sheet.")
        print("    Check that the service account has viewer access to the sheets.")
        return

    print("\n" + "=" * 60)
    print(f"Found {len(all_colours)} unique colours.\n")

    # Print them grouped, with one example cell each for identification
    # Sort by first occurrence row so header colours come first
    def sort_key(item):
        colour, occurrences = item
        first = occurrences[0]
        return (first[0], first[1], first[2])  # school, tab, row

    for colour, occurrences in sorted(all_colours.items(), key=sort_key):
        r, g, b = colour
        # Show the first few examples so you can identify the batch
        examples = occurrences[:3]
        ex_str = " | ".join(
            f"'{ex[4]}' (row {ex[2]}, col {ex[3]}, {ex[0]}/{ex[1]})"
            for ex in examples
        )
        count = len(occurrences)
        print(f"  ({r:.2f}, {g:.2f}, {b:.2f})  [{count:4d} cells]  e.g. {ex_str}")

    print("\n" + "=" * 60)
    print("Copy the entries below into COLOUR_BATCH_MAP at the top of this script,")
    print("replacing 'YEAR' with the correct batch year (2022 / 2023 / 2024 / 2025):\n")
    print("COLOUR_BATCH_MAP = {")
    for colour, occurrences in sorted(all_colours.items(), key=sort_key):
        r, g, b = colour
        ex = occurrences[0]
        print(f"    ({r:.2f}, {g:.2f}, {b:.2f}): \"YEAR\",  # e.g. '{ex[4][:50]}'")
    print("}")
    print()

# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate(service, school_name, school_info):
    """
    Fetch each tab of a school's sheet with colours and parse into tt dict.
    Returns (tt_dict, total_entry_count).
    """
    tt = {}
    total = 0

    # Discover actual tab names to help debug wrong tab name errors
    sheet_url = f"https://docs.google.com/spreadsheets/d/{school_info['id']}"
    dlog(f"--- {school_name.upper()} --- sheet: {sheet_url}")
    actual_tabs = get_sheet_tab_names(service, school_info["id"])
    dlog(f"  Actual tabs in sheet: {actual_tabs}")
    configured_tabs = school_info["tabs"]
    dlog(f"  Configured tabs    : {configured_tabs}")

    missing = [t for t in configured_tabs if t not in actual_tabs]
    if missing:
        dlog_error(
            f"  MISMATCH: tabs {missing} not found in sheet. Available: {actual_tabs}"
        )
        dlog_warn(
            f"  Fix: update SCHOOLS['{school_name}']['tabs'] to match one of: {actual_tabs}"
        )

    for tab in configured_tabs:

        # Only computing/engineering use tab names as weekdays
        if school_name != "business":
            day = tab.strip().capitalize()
            if day not in DAYS:
                dlog_warn(f"  Tab '{tab}' does not map to a valid day — skipping")
                continue
        else:
            day = None  # Business parser determines the day from column A

        print(f"  Fetching {school_name}/{tab}...", end=" ", flush=True)

        try:
            text_grid, colour_grid = fetch_sheet_with_colours(
                service, school_info["id"], tab
            )
        except Exception as e:
            print(f"ERROR: {e}")
            dlog_error(f"  fetch failed for {school_name}/{tab}: {e}")
            continue

        if not text_grid:
            print("empty — skipped")
            dlog_warn(f"  {school_name}/{tab} returned empty grid")
            continue

        if school_name == "business":
            # FSM business school uses paired-matrix format
            added = parse_business_grid(text_grid, day, tt)
        else:
            added = parse_grid_to_tt(text_grid, colour_grid, day, tt)

        total += added
        print(f"{added} entries")
        dlog(f"  {school_name}/{tab}: {added} entries parsed")

    dlog(f"  {school_name} total: {total} entries, {len(tt)} depts")
    return tt, total
# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def convert_to_reference_format(tt):
    """Convert internal {c,l,t} entries to {name,location,time}."""
    out = {}
    for dept, batches in tt.items():
        out[dept] = {}
        for batch, sections in batches.items():
            out[dept][batch] = {}
            for sec, days in sections.items():
                out[dept][batch][sec] = {}
                for day, entries in days.items():
                    out[dept][batch][sec][day] = [
                        {"name": e["c"], "location": e["l"], "time": e["t"]}
                        for e in entries
                    ]
    return out

def count_entries(tt):
    n = 0
    for batches in tt.values():
        for sections in batches.values():
            for days in sections.values():
                for entries in days.values():
                    n += len(entries)
    return n

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    discover_mode = "--discover" in sys.argv

    dlog(f"generate_timetable.py started — mode={'discover' if discover_mode else 'generate'}")
    dlog(f"Python: {sys.version}")

    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        dlog_error(f"'{SERVICE_ACCOUNT_FILE}' not found — cannot authenticate")
        print(f"ERROR: '{SERVICE_ACCOUNT_FILE}' not found.")
        flush_debug_log()
        return

    dlog(f"Loading credentials from {SERVICE_ACCOUNT_FILE}")
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)
    dlog(f"Google Sheets API client ready")

    if discover_mode:
        discover_colours(service)
        flush_debug_log()
        return

    dlog("Auto-detecting colour → batch mappings from sheet headers...")
    build_colour_map(service)

    if not COLOUR_BATCH_MAP:
        dlog_error("Could not auto-detect any colour mappings — aborting")
        flush_debug_log()
        return

    dlog(f"Colour map: {COLOUR_BATCH_MAP}")

    os.makedirs("db", exist_ok=True)
    total_entries = 0
    all_depts = set()

    for school_name, school_info in SCHOOLS.items():
        print(f"\nProcessing {school_name}...")
        tt, count = generate(service, school_name, school_info)
        total_entries += count
        ref_tt = convert_to_reference_format(tt)
        all_depts.update(ref_tt.keys())

        output = {
            "ok": True,
            "tt": ref_tt,
            "count": count_entries(ref_tt),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        out_path = os.path.join("db", f"timetable-{school_name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        dlog(f"Wrote {out_path} ({count_entries(ref_tt)} entries, {len(ref_tt)} depts)")
        print(f"  → {school_name}: {count} entries, {len(tt)} depts → {out_path}")

    print(f"\n{'=' * 50}")
    print(f"Done. {len(SCHOOLS)} school files written to db/")
    print(f"Total entries: {total_entries}")
    print(f"All departments: {', '.join(sorted(all_depts))}")
    dlog(f"Done. Total entries: {total_entries}. Depts: {sorted(all_depts)}")
    flush_debug_log()


if __name__ == "__main__":
    main()