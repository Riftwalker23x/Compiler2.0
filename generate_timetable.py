#!/usr/bin/env python3
"""
Generate timetable.json from Google Sheets using Sheets API v4.
Reads cell background colors to determine batch/year for each entry.

Setup:
  1. pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
  2. Go to https://console.cloud.google.com → create project → enable Google Sheets API
  3. Create a service account → download JSON key → save as service-account.json
  4. Share each sheet with the service account email (viewer)
  5. Run: python generate_timetable.py

Output: db/timetable-{school}.json (one per school)
"""

import json
import os
import re
from datetime import datetime, timezone
from collections import OrderedDict

from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
SERVICE_ACCOUNT_FILE = "service-account.json"

SCHOOLS = OrderedDict([
    ("computing", OrderedDict([
        ("id", "1ZQJqdArlwCS965uw4sbJrB6j8rEPfZerMT7X8qkXSzY"),
        ("tabs", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
    ])),
    ("business", OrderedDict([
        ("id", "1m5yFyi0QgWx0JhdEicQQL2JOEpSmcmVDOIi15_4p9Dw"),
        ("tabs", ["Monday"]),
    ])),
    ("engineering", OrderedDict([
        ("id", "1S3mWYvoM7HbIeiqAbt65FngdmYDUA8MWOQSjcUYsFXU"),
        ("tabs", ["Monday"]),
    ])),
])

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# ---------------------------------------------------------------------------
# STEP 1: Figure out which background colours map to which batch year.
#
# Open each sheet, look at the header / merged-cell rows and record the
# background colour that appears near each batch label like "BS CS (2025)".
# Then fill in this dict.  The RGB values are floats in [0, 1].
#
# Example entries (you must discover the actual colours by running once and
# inspecting the debug output):
#
#   (0.0, 0.0, 0.5): "2022",   # dark blue
#   (0.0, 0.5, 0.0): "2023",   # green
#   (1.0, 1.0, 0.0): "2024",   # yellow
#   (1.0, 0.5, 0.0): "2025",   # orange
#   (0.9, 0.9, 0.9): "2026",   # light grey (unused)
#
COLOUR_BATCH_MAP = {
    # Fill in after analysing sheet colours
}

# ---------------------------------------------------------------------------
# Regex helpers  (mirror the JS API parsers)
# ---------------------------------------------------------------------------

SLOT_COLS = {1: "08:30-09:50", 6: "10:00-11:20", 11: "11:30-12:50",
             16: "01:00-02:20", 21: "02:30-03:50", 26: "03:55-05:15",
             31: "05:20-06:40", 36: "06:45-08:05"}

LAB_SLOT_COLS = {1: "08:30-11:15", 11: "11:30-02:15",
                 21: "02:30-05:15", 31: "05:20-08:05"}

CELL_RE = re.compile(
    r"(.+?)\s*\(([A-Z]+(?:/[A-Z]+)*)(?:-([A-Z0-9]+))?"
    r"(?:,\s*(?:Gp?-([IV]+)|(\d{2})))?\s*\)",
    re.IGNORECASE
)

BATCH_MAP = {"25": "2025", "24": "2024", "23": "2023", "22": "2022"}

CLASSROOM_LEFT = {"room_col": 0, "end_col": 30,
                  "slot_cols": [1, 6, 11, 16, 21, 26],
                  "slot_map": {1: "08:30-09:50", 6: "10:00-11:20",
                               11: "11:30-12:50", 16: "01:00-02:20",
                               21: "02:30-03:50", 26: "03:55-05:15"}}
CLASSROOM_RIGHT = {"room_col": 30, "end_col": None,
                   "slot_cols": [31, 36],
                   "slot_map": {31: "05:20-06:40", 36: "06:45-08:05"}}
LAB_BLOCK = {"room_col": 0, "end_col": None,
             "slot_cols": [1, 11, 21, 31],
             "slot_map": {1: "08:30-11:15", 11: "11:30-02:15",
                          21: "02:30-05:15", 31: "05:20-08:05"}}


def clean(v):
    return str(v or "").replace("\u00a0", " ").strip()


def one_line(v):
    return re.sub(r"\s+", " ", clean(v))


def rgb_key(rgb):
    """Return a (R, G, B) tuple from a cell's 'effectiveFormat.backgroundColor'.
    Missing keys default to 0."""
    if not rgb:
        return None
    return (rgb.get("red", 0), rgb.get("green", 0), rgb.get("blue", 0))


def get_cell_colour(row_data, col_idx):
    """Extract background colour tuple from a row's cell data."""
    cells = row_data.get("values", [])
    if col_idx >= len(cells):
        return None
    cell = cells[col_idx]
    if "effectiveFormat" not in cell:
        return None
    bg = cell["effectiveFormat"].get("backgroundColor", {})
    if not bg:
        return None
    return rgb_key(bg)


def parse_timetable_cell(text):
    if not text:
        return None
    t = one_line(text)
    paren = t.find(")")
    core = t[:paren + 1] if paren >= 0 else t
    m = CELL_RE.match(core)
    if not m:
        return None
    course = m.group(1).strip()
    dept_str = m.group(2)
    section = m.group(3)
    if not section:
        return None
    depts = dept_str.split("/")
    return {"course": course, "depts": depts, "section": section}


def infer_batch_from_course(course_name):
    name = (course_name or "").upper()
    # 2022
    if re.search(r"\b(CAPSTONE|FYP|SENIOR\s+PROJECT|FINAL\s+YEAR\s+PROJECT|"
                 r"TECH\s+STARTUP|TECH\s+ENTREPRENEURSHIP|INNOVATION\s+LAB|"
                 r"RESEARCH\s+METHODS|AI\s+ETHICS|DIGITAL\s+FORENSICS|"
                 r"ETHICAL\s+HACK|MALWARE|BIG\s+DATA|BDA|AUTONOMOUS\s+VEHICLES|"
                 r"ROBOTICS|IOT|PROFESSIONAL\s+ETHICS|BUSINESS\s+COMMUNICATION|"
                 r"ENTRE|TECH\s+MGT|COMP\s+VISION|COMPUTER\s+VISION)\b", name):
        return "2022"
    # 2023
    if re.search(r"\b(COMPILER|COMP\s+CONST|PDC|PARALLEL|"
                 r"ARTIFICIAL\s+INTELLIGENCE|\bAI\b|MACHINE\s+LEARNING|\bML\b|"
                 r"DEEP\s+LEARN|DEEP\s+LEARNING|COMPUTER\s+NETWORKS|\bCN\b|"
                 r"COMP\s+NET|SOFTWARE\s+ENGINEERING|\bSE\b|SPM|"
                 r"PROJECT\s+MANAGEMENT|INFO\s+SEC|INFORMATION\s+SECURITY|PPIT|"
                 r"PROFESSIONAL\s+PRACTICES|IMAGE\s+PROCESSING|\bDIP\b|"
                 r"NATURAL\s+LANGUAGE|NLP|CLOUD\s+COMP|METRIC|GEN\s+AI|"
                 r"GENERATIVE\s+AI|PRODUCT\s+DEV|GAME\s+DEV|MOBILE\s+APP|"
                 r"STAT\s+MODELING|DIGITAL\s+MKTG|FIN\s+MGT)\b", name):
        return "2023"
    # 2024
    if re.search(r"\b(DATA\s+ST|DATA\s+STRUCTURES|OPERATING\s+SYSTEMS|\bOS\b|"
                 r"DATABASE|\bDB\b|REQUIREMENTS|SRE|DESIGN\s+&\s+ARCHITECTURE|"
                 r"SDA|COMPUTER\s+ORGANIZATION|COAL|PROBABILITY|PROB\s+&\s+STATS|"
                 r"STATS\s+FOR\s+ML|LINEAR\s+ALGEBRA|DATA\s+ANALYSIS)\b", name):
        return "2024"
    # 2025
    if re.search(r"\b(OBJECT|OOP|DISCRETE|DIGITAL\s+LOGIC|DLD|MULTIVARIABLE|"
                 r"MV\s+CALCULUS|APPLIED\s+PHYSICS|\bAP\b|PAK\s+STUDIES|"
                 r"PAKISTAN|FUNCTIONAL\s+ENGLISH|EXP\s+WRITING|EXPOSITORY|"
                 r"SEERAH|ISLAMIC|CIVICS|PROGRAMMING|\bPF\b|"
                 r"INTRO\s+TO\s+COMPUTING|ITC|CALCULUS|COMPOSITION)\b", name):
        return "2025"
    return None


def lookup_batch_for_col(col_colour_map, col, course_name, cell_text):
    # 1) explicit year suffix in cell: "(CS-A, 25)"
    m = re.search(r",\s*(\d{2})\s*\)", cell_text)
    if m:
        short = m.group(1)
        return BATCH_MAP.get(short, "20" + short)
    # 2) colour-based batch from header
    if col in col_colour_map and col_colour_map[col] != "MS":
        return col_colour_map[col]
    if col in col_colour_map and col_colour_map[col] == "MS":
        return None
    # 3) course-name inference
    return infer_batch_from_course(course_name) or "2023"


def normalise_room(room):
    r = one_line(room).upper()
    r = re.sub(r"\s+", " ", r)
    r = re.sub(r"\b([A-D])\s+(\d{3})\b", r"\1-\2", r)
    m = re.match(r"([A-D])\s*-\s*(\d{3}|IT\s*LAB\s*\d+|MARGALA\s*\d*|"
                 r"RAWAL\s*\d*|GPU\s*LAB|MEHRAN\s*\d*|CALL-\d+|DIGITAL\b)", r)
    if m:
        return f"{m.group(1).upper()}-{m.group(2).strip()}"
    return r


def add_course(tt, dept, batch, section, day, course, room, time):
    if not all([dept, batch, section, day, course, room, time]):
        return False
    depts = dept if isinstance(dept, list) else [dept]
    for d in depts:
        tt.setdefault(d, {})
        tt[d].setdefault(batch, {})
        tt[d][batch].setdefault(section, {})
        tt[d][batch][section].setdefault(day, [])
        arr = tt[d][batch][section][day]
        key = (course, room, time)
        if not any(x["c"] == course and x["l"] == room and x["t"] == time for x in arr):
            arr.append({"c": course, "l": room, "t": time})
    return True


# ---------------------------------------------------------------------------
# Sheet reading helpers
# ---------------------------------------------------------------------------


def find_header_row(grid):
    for r in range(min(len(grid), 10)):
        cell = one_line(grid[r][0] if grid[r] else "")
        if "room" in cell.lower():
            slots_found = 0
            for c_idx in SLOT_COLS:
                if c_idx < len(grid[r]):
                    val = one_line(grid[r][c_idx] or "")
                    if re.match(r"\d{1,2}:\d{2}", val):
                        slots_found += 1
            if slots_found >= 4:
                return r
    return -1


def find_lab_header_row(grid, after_row):
    for r in range(after_row, len(grid)):
        col_a = one_line(grid[r][0] if grid[r] else "").lower()
        if "lab" in col_a:
            return r
        if len(grid[r]) > 1:
            col_b = one_line(grid[r][1] or "")
            if re.match(r"^\d{1,2}:\d{2}-(?:1[0-5]|0\d|2[0-3]):\d{2}$", col_b):
                if sum(1 for c in grid[r] if one_line(c)) <= 6:
                    return r
    return -1


def parse_matrix_block(grid, start_row, end_row, block, day, tt,
                       col_colour_map):
    added = 0
    for r in range(start_row, min(end_row, len(grid))):
        row = grid[r]
        if not row:
            continue
        room = normalise_room(one_line(row[block["room_col"]] or ""))
        if (not room or len(room) < 2 or
                re.search(r"reserved|tutorial|fsm|fsa|fcss|fyp|travel|admin|room",
                          room, re.IGNORECASE)):
            continue
        sc = block["slot_cols"]
        for i in range(len(sc)):
            time_col = sc[i]
            next_col = sc[i + 1] if i + 1 < len(sc) else block.get("end_col", len(row))
            scan_end = min(next_col, len(row)) if next_col else len(row)
            for col in range(time_col, scan_end):
                cell = one_line(row[col] or "")
                if not cell:
                    continue
                parsed = parse_timetable_cell(cell)
                if not parsed:
                    continue
                batch = lookup_batch_for_col(col_colour_map, col,
                                             parsed["course"], cell)
                if not batch:
                    continue
                for dept_code in parsed["depts"]:
                    dept_key = f"BS {dept_code}"
                    if add_course(tt, dept_key, batch, parsed["section"],
                                  day, parsed["course"], room,
                                  block["slot_map"][time_col]):
                        added += 1
                break
    return added


def parse_grid_to_tt(grid, day, tt):
    hr = find_header_row(grid)
    if hr < 0:
        return 0
    lr = find_lab_header_row(grid, hr + 1)
    classroom_end = lr if lr > 0 else len(grid)
    added = 0
    added += parse_matrix_block(grid, hr + 1, classroom_end,
                                CLASSROOM_LEFT, day, tt, {})
    added += parse_matrix_block(grid, hr + 1, classroom_end,
                                CLASSROOM_RIGHT, day, tt, {})
    if lr > 0:
        added += parse_matrix_block(grid, lr + 1, len(grid),
                                    LAB_BLOCK, day, tt, {})
    return added


# ---------------------------------------------------------------------------
# Colour discovery helpers
# ---------------------------------------------------------------------------

def build_colour_batch_map_from_sheets(service, school_id, tabs):
    """
    Scan header rows of each tab, look for patterns like 'BS CS (2025)' or
    '2025' in merged cells, and record the background colour of those cells.
    Returns a dict: colour_tuple -> batch_year (string)
    """
    colour_map = {}
    for tab in tabs:
        range_name = f"'{tab}'!1:5"  # First 5 rows should cover headers
        result = service.spreadsheets().get(
            spreadsheetId=school_id,
            ranges=range_name,
            fields="sheets.data.rowData.values(effectiveFormat.backgroundColor,formattedValue)",
            includeGridData=True
        ).execute()
        sheets_data = result.get("sheets", [])
        if not sheets_data:
            print(f"  [WARN] No data for tab '{tab}'")
            continue
        rows = sheets_data[0].get("data", [{}])[0].get("rowData", [])
        for ri, row in enumerate(rows):
            cells = row.get("values", [])
            for ci, cell in enumerate(cells):
                fv = cell.get("formattedValue", "")
                bg = cell.get("effectiveFormat", {}).get("backgroundColor", {})
                if bg and fv:
                    colour_key = rgb_key(bg)
                    if colour_key and colour_key not in colour_map:
                        # Try to extract batch year from the cell value
                        m = re.search(r"(\d{4})", fv)
                        if m:
                            year = m.group(1)
                            if year in ("2022", "2023", "2024", "2025", "2026"):
                                colour_map[colour_key] = year
                                print(f"  Found colour {colour_key} -> batch {year} "
                                      f"at ({ri},{ci}): '{fv[:60]}'")
        if not colour_map:
            # Fallback: dump all header colours for manual mapping
            print(f"\n  [DEBUG] No batch-colour mapping found in '{tab}' headers.")
            print(f"  First 3 rows of grid[{tab}]:")
            for ri, row in enumerate(rows[:3]):
                cells = row.get("values", [])
                for ci, cell in enumerate(cells):
                    fv = cell.get("formattedValue", "")
                    bg = cell.get("effectiveFormat", {}).get("backgroundColor", {})
                    colour_key = rgb_key(bg)
                    if fv or colour_key:
                        print(f"    ({ri},{ci}) colour={colour_key!s:50s} value='{fv[:80]}'")
    return colour_map


def discover_colours():
    """Run this once to discover sheet colours, then hardcode COLOUR_BATCH_MAP."""
    print("Connecting to Google Sheets API v4...")
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)

    all_colours = {}
    for name, info in SCHOOLS.items():
        print(f"\nScanning {name}...")
        colours = build_colour_batch_map_from_sheets(service, info["id"], info["tabs"])
        all_colours.update(colours)
        print(f"  Found {len(colours)} colour->batch mappings")

    print(f"\nTotal unique colour->batch mappings: {len(all_colours)}")
    print("Add these to COLOUR_BATCH_MAP at the top of the script:")
    for c, y in sorted(all_colours.items(), key=lambda x: x[1]):
        r, g, b = c
        print(f"    ({r:.1f}, {g:.1f}, {b:.1f}): '{y}',  # RGB")
    return all_colours


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate(service, school_name, school_info, colour_map):
    """Parse a school's sheets and return (tt_dict, count)."""
    tt = {}
    total = 0
    for tab in school_info["tabs"]:
        day = tab.strip().capitalize()
        if day not in DAYS:
            continue
        print(f"  Fetching {school_name}/{tab}...")
        range_name = f"'{tab}'"
        result = service.spreadsheets().values().get(
            spreadsheetId=school_info["id"],
            range=range_name,
            valueRenderOption="FORMATTED_VALUE"
        ).execute()
        raw_values = result.get("values", [])
        if not raw_values:
            print(f"    [WARN] Empty tab")
            continue
        grid = [[clean(v) for v in (row or [])] for row in raw_values]
        added = parse_grid_to_tt(grid, day, tt)
        total += added
        print(f"    Parsed {added} entries from {tab}")

    return tt, total


def convert_to_reference_format(tt):
    """Convert {c,l,t} keys to {name,location,time} (fastschedule.github.io format)."""
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
    for deps in tt.values():
        for batches in deps.values():
            for sections in batches.values():
                for days in sections.values():
                    n += len(days)
    return n


def main():
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"ERROR: Service account file '{SERVICE_ACCOUNT_FILE}' not found.")
        print()
        print("To set up:")
        print("  1. Go to https://console.cloud.google.com")
        print("  2. Create a project (or select existing)")
        print("  3. Enable Google Sheets API")
        print("  4. Create a service account → download JSON key")
        print(f"  5. Save as '{SERVICE_ACCOUNT_FILE}' in this directory")
        print("  6. Share each spreadsheet with the service account email (viewer)")
        print("  7. Run this script again")
        print()
        print("First run: the script will discover colours and print them.")
        print("Copy those colour->batch mappings into COLOUR_BATCH_MAP at the top,")
        print("then run again to generate the actual timetable.json.")
        return

    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)

    if not COLOUR_BATCH_MAP:
        print("COLOUR_BATCH_MAP is empty. Running colour discovery mode...")
        print("After this run, copy the printed mappings into COLOUR_BATCH_MAP,")
        print("then run again to generate db/timetable-{school}.json files.")
        discover_colours()
        return

    os.makedirs("db", exist_ok=True)
    total_entries = 0
    all_depts = set()

    for school_name, school_info in SCHOOLS.items():
        print(f"\nProcessing {school_name}...")
        tt, count = generate(service, school_name, school_info, COLOUR_BATCH_MAP)
        total_entries += count
        ref_tt = convert_to_reference_format(tt)
        all_depts.update(ref_tt.keys())

        output = {
            "tt": ref_tt,
            "count": count_entries(ref_tt),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        out_path = os.path.join("db", f"timetable-{school_name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        print(f"  {school_name}: {count} entries, {len(tt)} departments → {out_path}")

    print(f"\n{'=' * 50}")
    print(f"Done! Generated {len(SCHOOLS)} school files in db/")
    print(f"Total entries: {total_entries}")
    print(f"All departments: {sorted(all_depts)}")


if __name__ == "__main__":
    main()
