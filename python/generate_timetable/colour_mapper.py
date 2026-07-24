"""Colour mapping and colour resolution helpers."""

import re

from .config import COLOUR_BATCH_MAP, SCHOOLS
from .helpers import one_line

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

# Batch key used for yellow-highlighted "repeat" classes. Yellow is the
# authoritative repeat signal (per the source sheet's convention), so it
# overrides year-suffix / colour-map batch resolution — see resolve_batch.
def is_yellow(colour):
    """True for a bright-yellow cell — the sheet's marker for a repeat class.
    High red + high green + low blue. Pale/peach legend colours (blue ~0.6)
    are intentionally excluded so only true yellow counts."""
    if colour is None:
        return False
    r, g, b = colour
    return r >= 0.8 and g >= 0.8 and b <= 0.5

def colour_to_batch(colour):
    """
    Look up a colour tuple in COLOUR_BATCH_MAP.
    Returns a year string like "2025", or None if not found / white.
    """
    if colour is None or is_white(colour):
        return None
    return COLOUR_BATCH_MAP.get(colour)

def build_colour_map(service):
    """
    Scan all sheets and auto-populate COLOUR_BATCH_MAP by parsing year from
    header cells like 'BS CS (2025)', 'BS AI (2022)', 'MS (CS)', etc.
    Only needs to scan the first few rows where headers live.
    """
    from .google_sheets import fetch_sheet_with_colours

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
