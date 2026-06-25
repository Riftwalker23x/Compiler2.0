#!/usr/bin/env python3
"""
generate_timetable.py — VTable / FAST NUCES Islamabad timetable generator
Reads Google Sheet cell background colours via Sheets API v4 to determine
which batch (2022–2025) each class belongs to, then outputs db/timetable.json.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SETUP (one-time, ~10 minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1.  pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client

2.  console.cloud.google.com
      -> New project
      -> Enable "Google Sheets API"
      -> IAM & Admin -> Service Accounts -> Create service account
      -> Actions -> Manage keys -> Add key -> JSON
      -> Save downloaded file as:  service-account.json  (same directory as this script)

3.  Open the timetable Google Sheet
      -> Share -> paste service account email -> Viewer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRST RUN (colour discovery)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    python generate_timetable.py --discover

    Prints every non-white colour found in header rows alongside
    the batch year text it was found near.
    Fill in COLOUR_BATCH_MAP below, then run normally.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NORMAL RUN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    python generate_timetable.py

    Outputs  db/timetable.json  ready for the frontend.
"""

import json, os, re, sys, argparse
from datetime import datetime, timezone
from google.oauth2 import service_account
from googleapiclient.discovery import build

# ── Configuration ──────────────────────────────────────────────────────────────

SCOPES               = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
SERVICE_ACCOUNT_FILE = "service-account.json"
OUTPUT_PATH          = os.path.join("db", "timetable-computing.json")

SHEET_ID = "1ZQJqdArlwCS965uw4sbJrB6j8rEPfZerMT7X8qkXSzY"
TABS     = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# ── COLOUR -> BATCH MAP ────────────────────────────────────────────────────────
# Fill this in after running:  python generate_timetable.py --discover
#
# Keys:   (red, green, blue) floats rounded to 3 decimal places
# Values: 4-digit batch year string
#
# Example:
#   COLOUR_BATCH_MAP = {
#       (1.0,   0.902, 0.6):   "2025",
#       (0.714, 0.843, 0.659): "2024",
#       (0.647, 0.808, 0.89):  "2023",
#       (0.918, 0.702, 0.490): "2022",
#   }
#
COLOUR_BATCH_MAP: dict[tuple, str] = {
    # <- paste --discover output here
}

# ── Sheet layout ───────────────────────────────────────────────────────────────

CLASSROOM_LEFT_BLOCK = {
    "room_col": 0, "end_col": 30,
    "slot_cols": [1, 6, 11, 16, 21, 26],
    "slot_map": {
        1: "08:30-09:50", 6: "10:00-11:20", 11: "11:30-12:50",
        16: "01:00-02:20", 21: "02:30-03:50", 26: "03:55-05:15",
    },
}
CLASSROOM_RIGHT_BLOCK = {
    "room_col": 30, "end_col": None,
    "slot_cols": [31, 36],
    "slot_map": {31: "05:20-06:40", 36: "06:45-08:05"},
}
LAB_BLOCK = {
    "room_col": 0, "end_col": None,
    "slot_cols": [1, 11, 21, 31],
    "slot_map": {
        1: "08:30-11:15", 11: "11:30-02:15",
        21: "02:30-05:15", 31: "05:20-08:05",
    },
}

YEAR_SHORT_MAP = {"25": "2025", "24": "2024", "23": "2023", "22": "2022"}

CELL_RE = re.compile(
    r"(.+?)\s*\("
    r"([A-Z]+(?:/[A-Z]+)*)"
    r"(?:-([A-Z0-9]+))?"
    r"(?:,\s*(?:Gp?-([IV]+)|(\d{2})))?"
    r"\s*\)",
    re.IGNORECASE,
)

# ── Text helpers ───────────────────────────────────────────────────────────────

def clean(v):
    return str(v or "").replace("\u00a0", " ").strip()

def one_line(v):
    return re.sub(r"\s+", " ", clean(v)).strip()

# ── Colour helpers ─────────────────────────────────────────────────────────────

def rgb_key(bg):
    if not bg:
        return None
    return (round(bg.get("red", 0.0), 3),
            round(bg.get("green", 0.0), 3),
            round(bg.get("blue", 0.0), 3))

def is_white(colour):
    return colour is None or all(c >= 0.97 for c in colour)

def colour_to_batch(colour, colour_map):
    if is_white(colour):
        return None
    if colour in colour_map:
        return colour_map[colour]
    for k, v in colour_map.items():
        if all(abs(colour[i] - k[i]) < 0.012 for i in range(3)):
            return v
    return None

# ── Sheets API ─────────────────────────────────────────────────────────────────

def build_service():
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"ERROR: '{SERVICE_ACCOUNT_FILE}' not found.")
        print("See SETUP at the top of this file.")
        sys.exit(1)
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def fetch_tab(service, sheet_id, tab):
    """Returns (grid, row_data_list) for one tab."""
    vals = (service.spreadsheets().values()
            .get(spreadsheetId=sheet_id, range=f"'{tab}'",
                 valueRenderOption="FORMATTED_VALUE")
            .execute())
    grid = [[clean(c) for c in (row or [])] for row in vals.get("values", [])]

    fmt = (service.spreadsheets()
           .get(spreadsheetId=sheet_id, ranges=[f"'{tab}'!1:6"],
                fields="sheets.data.rowData.values(effectiveFormat.backgroundColor,formattedValue)",
                includeGridData=True)
           .execute())
    row_data = (fmt.get("sheets", [{}])[0]
                   .get("data",   [{}])[0]
                   .get("rowData", []))
    return grid, row_data

# ── Column -> batch map ────────────────────────────────────────────────────────

def build_col_batch_map(row_data_list, colour_map):
    col_map = {}
    for row_data in row_data_list:
        for ci, cell in enumerate(row_data.get("values", [])):
            fv     = str(cell.get("formattedValue", "") or "")
            colour = rgb_key(cell.get("effectiveFormat", {}).get("backgroundColor", {}))

            # 1. Colour lookup
            batch = colour_to_batch(colour, colour_map)
            if batch and ci not in col_map:
                col_map[ci] = batch
                continue

            # 2. Explicit year text in cell
            m = re.search(r"\b(202[2-9])\b", fv)
            if m and ci not in col_map:
                col_map[ci] = m.group(1)

    return col_map


def lookup_batch(col_map, col, year_suffix):
    # 1. Explicit suffix in cell text
    if year_suffix:
        return YEAR_SHORT_MAP.get(year_suffix, "20" + year_suffix)
    # 2. Exact column
    if col in col_map:
        return col_map[col]
    # 3. Nearest column to the left
    candidates = [(c, b) for c, b in col_map.items() if c <= col]
    if candidates:
        return max(candidates, key=lambda x: x[0])[1]
    return None

# ── Cell parser ────────────────────────────────────────────────────────────────

def parse_cell(text):
    t = one_line(text)
    if not t:
        return None
    paren_end = t.find(")")
    core = t[:paren_end + 1] if paren_end >= 0 else t
    m = CELL_RE.match(core)
    if not m:
        return None
    section = m.group(3)
    if not section:
        return None
    return {
        "course":      m.group(1).strip(),
        "depts":       m.group(2).upper().split("/"),
        "section":     section.upper(),
        "year_suffix": m.group(5),
    }

# ── Room normaliser ────────────────────────────────────────────────────────────

def norm_room(room):
    r = one_line(room).upper()
    r = re.sub(r"\s+", " ", r)
    r = re.sub(r"\b([A-D])\s+(\d{3})\b", r"\1-\2", r)
    m = re.match(r"([A-D])\s*-\s*(\d{3}|IT\s*LAB\s*\d+|MARGALA\s*\d*|"
                 r"RAWAL\s*\d*|GPU\s*LAB|MEHRAN\s*\d*|CALL-\d+|DIGITAL\b)", r)
    if m:
        return f"{m.group(1)}-{m.group(2).strip()}"
    if "AUDI" in r:
        return "D-AUDI"
    m2 = re.search(r"CYBER\s*\(?\s*([A-D])-(\d{3})", r)
    if m2:
        return f"Cyber ({m2.group(1)}-{m2.group(2)})"
    return r

# ── Timetable builder ──────────────────────────────────────────────────────────

def add_entry(tt, dept, batch, section, day, course, room, time):
    if not all([dept, batch, section, day, course, room, time]):
        return False
    arr = (tt.setdefault(dept, {})
             .setdefault(batch, {})
             .setdefault(section, {})
             .setdefault(day, []))
    if not any(x["name"] == course and x["location"] == room and x["time"] == time
               for x in arr):
        arr.append({"name": course, "location": room, "time": time})
        return True
    return False

# ── Grid structure finders ─────────────────────────────────────────────────────

def find_header_row(grid):
    for r, row in enumerate(grid[:10]):
        if not row:
            continue
        if re.search(r"\broom\b", one_line(row[0] or ""), re.I):
            slots = sum(1 for ci in [1, 6, 11, 16, 21, 26]
                        if ci < len(row) and re.match(r"\d{1,2}:\d{2}", one_line(row[ci] or "")))
            if slots >= 4:
                return r
    return -1

def find_lab_header_row(grid, after):
    for r in range(after, len(grid)):
        row = grid[r]
        if not row:
            continue
        if "lab" in one_line(row[0] or "").lower():
            return r
    return -1

# ── Block parser ───────────────────────────────────────────────────────────────

def parse_block(grid, start_row, end_row, block, day, tt, col_map):
    added = 0
    for r in range(start_row, min(end_row, len(grid))):
        row = grid[r]
        if not row:
            continue
        room = norm_room(one_line(row[block["room_col"]] if block["room_col"] < len(row) else ""))
        if not room or len(room) < 2:
            continue
        if re.search(r"reserved|tutorial|fsm|fsa|fcss|fyp|travel|admin|^room$", room, re.I):
            continue

        for i, time_col in enumerate(block["slot_cols"]):
            next_col  = block["slot_cols"][i + 1] if i + 1 < len(block["slot_cols"]) else (block["end_col"] or len(row))
            scan_end  = min(next_col, len(row)) if next_col else len(row)
            time_label = block["slot_map"][time_col]

            for col in range(time_col, scan_end):
                if col >= len(row):
                    break
                cell   = one_line(row[col] or "")
                parsed = parse_cell(cell)
                if not parsed:
                    continue
                batch = lookup_batch(col_map, col, parsed["year_suffix"])
                if not batch:
                    continue
                for dept_code in parsed["depts"]:
                    if add_entry(tt, f"BS {dept_code}", batch, parsed["section"],
                                 day, parsed["course"], room, time_label):
                        added += 1
                break  # one entry per slot per room
    return added

# ── Full grid parser ───────────────────────────────────────────────────────────

def parse_grid(grid, day, tt, col_map):
    hr = find_header_row(grid)
    if hr < 0:
        print(f"    WARNING: header row not found for {day}")
        return 0
    lr            = find_lab_header_row(grid, hr + 1)
    classroom_end = lr if lr > 0 else len(grid)

    added  = parse_block(grid, hr + 1, classroom_end, CLASSROOM_LEFT_BLOCK,  day, tt, col_map)
    added += parse_block(grid, hr + 1, classroom_end, CLASSROOM_RIGHT_BLOCK, day, tt, col_map)
    if lr > 0:
        added += parse_block(grid, lr + 1, len(grid), LAB_BLOCK, day, tt, col_map)
    return added

# ── Output builder ─────────────────────────────────────────────────────────────

_SLOT_MINUTES = {
    "08:30": 510, "10:00": 600, "11:30": 690, "01:00": 780,
    "02:30": 870, "03:55": 955, "05:20": 1040, "06:45": 1125,
    "08:30-11:15": 510, "11:30-02:15": 690, "02:30-05:15": 870, "05:20-08:05": 1040,
}

def slot_minutes(slot):
    start = str(slot or "").split("-")[0]
    return _SLOT_MINUTES.get(slot, _SLOT_MINUTES.get(start, 9999))

def build_output(tt):
    """Sort entries within each day by slot time. Returns dept->batch->section->day->[] shape,
    which is what the frontend's applyTimetablePayload expects under the 'tt' key."""
    out = {}
    for dept, batches in tt.items():
        out[dept] = {}
        for batch, sections in batches.items():
            out[dept][batch] = {}
            for section, days in sections.items():
                out[dept][batch][section] = {}
                for day, entries in days.items():
                    out[dept][batch][section][day] = sorted(
                        entries, key=lambda e: slot_minutes(e["time"])
                    )
    return out

def count_entries(tt):
    n = 0
    for batches in tt.values():
        for sections in batches.values():
            for days in sections.values():
                for arr in days.values():
                    n += len(arr)
    return n

# ── Discovery mode ─────────────────────────────────────────────────────────────

def run_discovery(service):
    print("\n=== COLOUR DISCOVERY MODE ===")
    print("Scanning header rows (1-6) for batch colours...\n")
    found = {}

    for tab in TABS:
        print(f"  Tab: {tab}")
        try:
            _, row_data = fetch_tab(service, SHEET_ID, tab)
        except Exception as e:
            print(f"    ERROR: {e}")
            continue
        for ri, row in enumerate(row_data):
            for ci, cell in enumerate(row.get("values", [])):
                fv     = str(cell.get("formattedValue", "") or "")
                colour = rgb_key(cell.get("effectiveFormat", {}).get("backgroundColor", {}))
                if is_white(colour):
                    continue
                m = re.search(r"\b(202[2-9])\b", fv)
                if m and colour not in found:
                    found[colour] = m.group(1)
                    print(f"    row {ri} col {ci}  colour={colour}  ->  {m.group(1)}  ('{fv[:60]}')")

    if not found:
        print("\nNo colour+year pairs found. Dumping ALL non-white header colours:\n")
        try:
            _, row_data = fetch_tab(service, SHEET_ID, TABS[0])
        except Exception:
            return
        for ri, row in enumerate(row_data):
            for ci, cell in enumerate(row.get("values", [])):
                fv     = str(cell.get("formattedValue", "") or "")
                colour = rgb_key(cell.get("effectiveFormat", {}).get("backgroundColor", {}))
                if not is_white(colour):
                    print(f"  ({ri},{ci})  colour={colour}  value='{fv[:80]}'")
        print("\nMatch colours visually to batch years in the sheet, then fill COLOUR_BATCH_MAP.")
        return

    print("\n--- Paste this into COLOUR_BATCH_MAP ---")
    print("COLOUR_BATCH_MAP: dict[tuple, str] = {")
    for colour, year in sorted(found.items(), key=lambda x: x[1]):
        r, g, b = colour
        print(f'    ({r}, {g}, {b}): "{year}",')
    print("}")
    print("-----------------------------------------")
    print("Then run:  python generate_timetable.py")

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="VTable timetable generator")
    ap.add_argument("--discover", action="store_true",
                    help="Print cell colours from header rows then exit")
    args = ap.parse_args()

    service = build_service()

    if args.discover:
        run_discovery(service)
        return

    if not COLOUR_BATCH_MAP:
        print("ERROR: COLOUR_BATCH_MAP is empty.")
        print("Run:  python generate_timetable.py --discover")
        print("Then fill in COLOUR_BATCH_MAP at the top of this file.")
        sys.exit(1)

    print("Generating timetable.json...")
    tt = {}
    total_added = 0

    for tab in TABS:
        day = tab.strip().capitalize()
        print(f"  Fetching {tab}...", end=" ", flush=True)
        try:
            grid, row_data = fetch_tab(service, SHEET_ID, tab)
        except Exception as e:
            print(f"ERROR: {e}")
            continue

        col_map     = build_col_batch_map(row_data, COLOUR_BATCH_MAP)
        added       = parse_grid(grid, day, tt, col_map)
        total_added += added
        print(f"{added} entries  (col_map: {len(col_map)} anchors, batches: {sorted(set(col_map.values()))})")

    if not total_added:
        print("\nERROR: 0 entries parsed.")
        print("  1. Check COLOUR_BATCH_MAP matches --discover output")
        print("  2. Verify sheet is shared with the service account (Viewer)")
        print("  3. Run --discover again to inspect colours")
        sys.exit(1)

    out = build_output(tt)
    n   = count_entries(out)
    os.makedirs("db", exist_ok=True)
    payload = {
        "ok": True,
        "count": n,
        "school": "computing",
        "source": "generated",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "tt": out,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    depts = sorted(out)
    print(f"\nDone — {n} entries written to {OUTPUT_PATH}")
    print(f"Departments: {depts}")

if __name__ == "__main__":
    main()
