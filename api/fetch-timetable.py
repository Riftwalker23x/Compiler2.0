"""
Vercel Serverless Function: GET/POST /api/fetch-timetable

Fetches the latest unread Gmail message whose subject contains "seatingplan",
parses the body into structured JSON, and commits it to dbfolder/seating-plan.json
via the GitHub REST API (Vercel's filesystem is read-only at runtime).

Required environment variables:
  GMAIL_USER  – Gmail address
  GMAIL_PASS  – Gmail App Password (not your regular password)
  GH_TOKEN    – GitHub PAT with repo contents write access

Optional environment variables:
  GH_REPO     – "owner/repo" (defaults to VERCEL_GIT_REPO_OWNER/SLUG)
  GH_BRANCH   – target branch (default: main)
"""

from __future__ import annotations

import base64
import email
import imaplib
import json
import os
import re
import ssl
from datetime import datetime, timezone
from email.header import decode_header
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# ── Constants ────────────────────────────────────────────────────────────────

GMAIL_IMAP_HOST = "imap.gmail.com"
GMAIL_IMAP_PORT = 993
SUBJECT_KEYWORD = "seatingplan"
REPO_FILE_PATH = "dbfolder/seating-plan.json"

# Column header aliases → canonical JSON field names
FIELD_ALIASES: dict[str, str] = {
    "name": "name",
    "student name": "name",
    "student": "name",
    "nuid": "nuid",
    "nu id": "nuid",
    "nu-id": "nuid",
    "id": "nuid",
    "roll": "nuid",
    "roll no": "nuid",
    "roll number": "nuid",
    "paper": "paper",
    "subject": "paper",
    "course": "paper",
    "exam": "paper",
    "paper name": "paper",
    "time": "time",
    "exam time": "time",
    "slot": "time",
    "class": "class",
    "room": "class",
    "hall": "class",
    "venue": "class",
    "class room": "class",
    "classroom": "class",
    "seat": "seat",
    "seat no": "seat",
    "seat number": "seat",
    "seatno": "seat",
    "position": "seat",
}

KV_ALIASES: dict[str, str] = {
    "name": "name",
    "student name": "name",
    "nuid": "nuid",
    "nu id": "nuid",
    "nu-id": "nuid",
    "roll": "nuid",
    "paper": "paper",
    "subject": "paper",
    "course": "paper",
    "time": "time",
    "class": "class",
    "room": "class",
    "hall": "class",
    "seat": "seat",
    "seat no": "seat",
    "seat number": "seat",
}


# ── Response helpers ───────────────────────────────────────────────────────────

def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


# ── Gmail IMAP ─────────────────────────────────────────────────────────────────

def decode_mime_header(value: str) -> str:
    """Decode RFC 2047 encoded email headers into a plain string."""
    parts = decode_header(value or "")
    decoded: list[str] = []
    for fragment, charset in parts:
        if isinstance(fragment, bytes):
            decoded.append(fragment.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(fragment)
    return "".join(decoded).strip()


def extract_plain_text(msg: email.message.Message) -> str:
    """
    Walk the MIME tree and return the best available plain-text body.
    Falls back to stripped HTML when no text/plain part exists.
    """
    if msg.is_multipart():
        plain_parts: list[str] = []
        html_parts: list[str] = []
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if "attachment" in disposition.lower():
                continue
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            text = payload.decode(charset, errors="replace")
            if content_type == "text/plain":
                plain_parts.append(text)
            elif content_type == "text/html":
                html_parts.append(text)
        if plain_parts:
            return "\n".join(plain_parts)
        if html_parts:
            return strip_html("\n".join(html_parts))
        return ""
    payload = msg.get_payload(decode=True)
    if payload is None:
        return str(msg.get_payload())
    charset = msg.get_content_charset() or "utf-8"
    text = payload.decode(charset, errors="replace")
    if msg.get_content_type() == "text/html":
        return strip_html(text)
    return text


def strip_html(html: str) -> str:
    """Minimal HTML → text conversion for seating-plan table emails."""
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", html)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</tr>", "\n", text)
    text = re.sub(r"(?i)</t[dh]>", "\t", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def fetch_latest_seating_email() -> tuple[str, str, bytes]:
    """
    Connect to Gmail IMAP, find the newest UNSEEN message whose subject
    contains SUBJECT_KEYWORD, and return (subject, plain_body, raw_bytes).
    Marks the message as \\Seen after a successful read.
    """
    user = os.environ.get("GMAIL_USER", "").strip()
    password = os.environ.get("GMAIL_PASS", "").strip()
    if not user or not password:
        raise RuntimeError("GMAIL_USER and GMAIL_PASS environment variables are required")

    context = ssl.create_default_context()
    mail = imaplib.IMAP4_SSL(GMAIL_IMAP_HOST, GMAIL_IMAP_PORT, ssl_context=context)
    try:
        mail.login(user, password)
        mail.select("INBOX")

        # IMAP SUBJECT search is case-insensitive on Gmail
        status, data = mail.search(None, "UNSEEN", f'(SUBJECT "{SUBJECT_KEYWORD}")')
        if status != "OK":
            raise RuntimeError(f"IMAP search failed: {status}")

        ids = data[0].split() if data and data[0] else []
        if not ids:
            raise RuntimeError('No unread emails found with "seatingplan" in the subject')

        # Latest message = highest UID
        latest_id = ids[-1]
        status, fetched = mail.fetch(latest_id, "(RFC822)")
        if status != "OK" or not fetched or not fetched[0]:
            raise RuntimeError("Failed to fetch email payload")

        raw_bytes = fetched[0][1]
        msg = email.message_from_bytes(raw_bytes)
        subject = decode_mime_header(msg.get("Subject", ""))
        body = extract_plain_text(msg)

        # Mark as read so the same email is not re-processed
        mail.store(latest_id, "+FLAGS", "\\Seen")
        return subject, body, raw_bytes
    finally:
        try:
            mail.logout()
        except Exception:
            pass


# ── Email body → JSON parsing ──────────────────────────────────────────────────

def normalize_header(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (label or "").lower()).strip()


def detect_delimiter(line: str) -> str | None:
    if "\t" in line:
        return "\t"
    if "|" in line:
        return "|"
    if "," in line and line.count(",") >= 3:
        return ","
    if ";" in line and line.count(";") >= 3:
        return ";"
    return None


def split_row(line: str, delimiter: str) -> list[str]:
    if delimiter == ",":
        # Simple CSV split (seating plans rarely contain quoted commas)
        return [cell.strip() for cell in line.split(",")]
    return [cell.strip() for cell in line.split(delimiter)]


def map_header_indices(headers: list[str]) -> dict[str, int]:
    """Map canonical field names to column indices from a header row."""
    mapping: dict[str, int] = {}
    for idx, header in enumerate(headers):
        canonical = FIELD_ALIASES.get(normalize_header(header))
        if canonical and canonical not in mapping:
            mapping[canonical] = idx
    return mapping


def row_to_entry(cells: list[str], col_map: dict[str, int]) -> dict[str, str] | None:
    """Convert one tabular row into a student entry dict."""
    entry: dict[str, str] = {}
    for field, idx in col_map.items():
        if idx < len(cells):
            value = cells[idx].strip()
            if value:
                entry[field] = value
    if entry.get("name") or entry.get("nuid"):
        return entry
    return None


def parse_tabular_body(text: str) -> list[dict[str, str]]:
    """
    DATA PARSING – tabular format
    Detects a header row (Name | NUID | Paper | Time | Class | Seat) and
    maps every subsequent row into the JSON student list.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []

    header_idx = -1
    delimiter: str | None = None
    col_map: dict[str, int] = {}

    for i, line in enumerate(lines):
        delim = detect_delimiter(line)
        if not delim:
            continue
        cells = split_row(line, delim)
        candidate = map_header_indices(cells)
        # Require at least name/nuid plus one seating field
        if ("name" in candidate or "nuid" in candidate) and (
            "paper" in candidate or "class" in candidate or "seat" in candidate
        ):
            header_idx = i
            delimiter = delim
            col_map = candidate
            break

    if header_idx < 0 or not delimiter:
        return []

    entries: list[dict[str, str]] = []
    for line in lines[header_idx + 1 :]:
        if re.match(r"^[-_=]{3,}$", line):
            continue
        cells = split_row(line, delimiter)
        if len(cells) < 2:
            continue
        entry = row_to_entry(cells, col_map)
        if entry:
            entries.append(entry)
    return entries


def parse_key_value_body(text: str) -> list[dict[str, str]]:
    """
    DATA PARSING – key:value blocks
    Handles emails formatted as repeated blocks like:
      Name: Alice
      NUID: 21L-1234
      Paper: Data Structures
    """
    blocks = re.split(r"\n\s*\n", text.strip())
    entries: list[dict[str, str]] = []

    for block in blocks:
        entry: dict[str, str] = {}
        for line in block.splitlines():
            match = re.match(r"^([^:]+):\s*(.+)$", line.strip())
            if not match:
                continue
            key = KV_ALIASES.get(normalize_header(match.group(1)))
            value = match.group(2).strip()
            if key and value:
                entry[key] = value
        if entry.get("name") or entry.get("nuid"):
            entries.append(entry)

    return entries


def normalize_seat(seat: str) -> str:
    """
    Normalize seat labels to C3R5 style (Column 3, Row 5).
    Accepts: C3R5, C-3 R-5, Col3 Row5, 3C5R, etc.
    """
    raw = (seat or "").upper().strip()
    if not raw:
        return ""

    m = re.search(r"C\s*[-:]?\s*(\d+)\s*R\s*[-:]?\s*(\d+)", raw)
    if m:
        return f"C{m.group(1)}R{m.group(2)}"

    m = re.search(r"COL(?:UMN)?\s*(\d+).{0,6}ROW\s*(\d+)", raw)
    if m:
        return f"C{m.group(1)}R{m.group(2)}"

    m = re.search(r"(\d+)\s*C.*?(\d+)\s*R", raw)
    if m:
        return f"C{m.group(1)}R{m.group(2)}"

    return raw


def normalize_entry(entry: dict[str, str]) -> dict[str, str]:
    """Apply final cleanup to a parsed student record."""
    normalized = {
        "name": entry.get("name", "").strip(),
        "nuid": entry.get("nuid", "").strip().upper(),
        "paper": entry.get("paper", "").strip(),
        "time": entry.get("time", "").strip(),
        "class": entry.get("class", "").strip(),
        "seat": normalize_seat(entry.get("seat", "")),
    }
    return {k: v for k, v in normalized.items() if v}


def parse_seating_plan_email(body: str, subject: str) -> dict[str, Any]:
    """
    Main DATA PARSING entry point.
    Tries tabular parsing first, then key:value blocks.
    Returns the full JSON document written to dbfolder/seating-plan.json.
    """
    students = parse_tabular_body(body)
    if not students:
        students = parse_key_value_body(body)

    cleaned = [normalize_entry(s) for s in students]
    cleaned = [s for s in cleaned if s.get("name") or s.get("nuid")]

    if not cleaned:
        raise ValueError(
            "Could not parse any student records from the email body. "
            "Expected a header row (Name, NUID, Paper, Time, Class, Seat) "
            "or key:value blocks."
        )

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_subject": subject,
        "count": len(cleaned),
        "students": cleaned,
    }


# ── GitHub REST API commit ─────────────────────────────────────────────────────

def github_request(method: str, url: str, token: str, payload: dict | None = None) -> Any:
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "vtable-seating-sync",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"GitHub API network error: {exc}") from exc


def resolve_repo() -> tuple[str, str]:
    repo = os.environ.get("GH_REPO", "").strip()
    if repo and "/" in repo:
        owner, name = repo.split("/", 1)
        return owner, name
    owner = os.environ.get("VERCEL_GIT_REPO_OWNER", "").strip()
    slug = os.environ.get("VERCEL_GIT_REPO_SLUG", "").strip()
    if owner and slug:
        return owner, slug
    raise RuntimeError(
        "Set GH_REPO (owner/repo) or deploy via Vercel so "
        "VERCEL_GIT_REPO_OWNER and VERCEL_GIT_REPO_SLUG are available"
    )


def commit_json_to_github(document: dict[str, Any]) -> dict[str, Any]:
    """
    Upsert dbfolder/seating-plan.json in the connected GitHub repository.
    Fetches the existing blob SHA when the file already exists, then PUTs
    the new base64-encoded content (full replace, not a merge).
    """
    token = os.environ.get("GH_TOKEN", "").strip()
    if not token:
        raise RuntimeError("GH_TOKEN environment variable is required")

    owner, repo = resolve_repo()
    branch = os.environ.get("GH_BRANCH", "main").strip() or "main"
    api_base = f"https://api.github.com/repos/{owner}/{repo}/contents/{REPO_FILE_PATH}"

    existing_sha: str | None = None
    try:
        meta = github_request(
            "GET",
            f"{api_base}?ref={branch}",
            token,
        )
        existing_sha = meta.get("sha")
    except RuntimeError as exc:
        if "404" not in str(exc):
            raise

    content_bytes = json.dumps(document, indent=2, ensure_ascii=False).encode("utf-8")
    payload: dict[str, Any] = {
        "message": f"Sync seating plan from Gmail ({document.get('count', 0)} students)",
        "content": base64.b64encode(content_bytes).decode("ascii"),
        "branch": branch,
    }
    if existing_sha:
        payload["sha"] = existing_sha

    result = github_request("PUT", api_base, token, payload)
    return {
        "committed": True,
        "path": REPO_FILE_PATH,
        "branch": branch,
        "sha": result.get("content", {}).get("sha"),
        "html_url": result.get("content", {}).get("html_url"),
    }


# ── Vercel handler ───────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    """Vercel Python entrypoint – trigger via GET or POST /api/fetch-timetable."""

    def do_GET(self) -> None:
        self._run_sync()

    def do_POST(self) -> None:
        self._run_sync()

    def _run_sync(self) -> None:
        try:
            subject, body, _raw = fetch_latest_seating_email()
            document = parse_seating_plan_email(body, subject)
            commit_info = commit_json_to_github(document)
            json_response(
                self,
                200,
                {
                    "ok": True,
                    "message": "Seating plan synced successfully",
                    "students_parsed": document["count"],
                    "source_subject": subject,
                    "github": commit_info,
                },
            )
        except Exception as exc:  # noqa: BLE001 – surface all sync failures to caller
            json_response(
                self,
                500,
                {
                    "ok": False,
                    "error": str(exc),
                },
            )

    def log_message(self, format: str, *args: Any) -> None:
        # Suppress default stderr logging on Vercel
        return
