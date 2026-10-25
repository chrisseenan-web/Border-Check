"""Check the site's data files before publishing.

Run from the site folder:  python3 scripts/check_data.py

It checks that every CSV row has the right number of columns, that every
figure has a source link and a valid date, that every {{id.column}} used in
data/myths.json exists, and lists figures whose next release is probably out.
"""
import csv
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data"
CADENCE_DAYS = {"monthly": 35, "quarterly": 100, "annual": 380}
problems = []


def read_csv(name, required):
    path = ROOT / name
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        head = next(reader)
        rows = []
        for n, row in enumerate(reader, start=2):
            if not any(row):
                continue
            if len(row) != len(head):
                problems.append(f"{name} line {n}: {len(row)} columns, expected {len(head)}. A value containing a comma needs \"quotes\".")
                continue
            rows.append(dict(zip(head, row)))
    missing = [c for c in required if c not in head]
    if missing:
        problems.append(f"{name}: missing columns {missing}")
    return rows


figures = read_csv("figures.csv", ["id", "measure", "topic", "scotland", "england", "comparable", "source_url", "cadence", "last_checked"])
by_id = {}
for f in figures:
    if f["id"] in by_id:
        problems.append(f"figures.csv: duplicate id {f['id']}")
    by_id[f["id"]] = f
    if not f["source_url"].startswith("http"):
        problems.append(f"figures.csv {f['id']}: source_url is missing or not a link")
    if f["comparable"] not in ("yes", "caution", "no"):
        problems.append(f"figures.csv {f['id']}: comparable must be yes, caution or no")
    if f["cadence"] not in CADENCE_DAYS:
        problems.append(f"figures.csv {f['id']}: cadence must be monthly, quarterly or annual")
    try:
        datetime.strptime(f["last_checked"], "%Y-%m-%d")
    except ValueError:
        problems.append(f"figures.csv {f['id']}: last_checked must be YYYY-MM-DD")

series = read_csv("series.csv", ["series", "period", "order", "value"])
for s in series:
    try:
        float(s["value"])
    except ValueError:
        problems.append(f"series.csv {s['series']} {s['period']}: value must be a plain number (no commas or %)")

updates = read_csv("updates.csv", ["date", "type", "summary"])
releases = read_csv("releases.csv", ["publication", "figures", "url"])
for r in releases:
    for fid in filter(None, r["figures"].split(";")):
        if fid not in by_id:
            problems.append(f"releases.csv '{r['publication']}': unknown figure id {fid}")

myths = json.loads((ROOT / "myths.json").read_text(encoding="utf-8"))
text = json.dumps(myths)
for fid, col in re.findall(r"\{\{\s*(\w+)\.(\w+)\s*\}\}", text):
    if fid not in by_id:
        problems.append(f"myths.json uses unknown figure {fid}")
    elif not by_id[fid].get(col):
        problems.append(f"myths.json uses {fid}.{col}, which is empty in figures.csv")
for m in myths["myths"]:
    for fid in m["figures"]:
        if fid not in by_id:
            problems.append(f"myths.json {m['id']} lists unknown figure {fid}")

today = date.today()
due = []
for f in figures:
    try:
        age = (today - datetime.strptime(f["last_checked"], "%Y-%m-%d").date()).days
    except ValueError:
        continue
    if age > CADENCE_DAYS.get(f["cadence"], 380):
        due.append(f"  {f['id']}: last checked {f['last_checked']} ({f['cadence']})")

print(f"{len(figures)} figures, {len(series)} trend points, {len(updates)} log entries, {len(releases)} publications")
if due:
    print("Figures due a check:")
    print("\n".join(due))
else:
    print("No figures are due a check.")
if problems:
    print("\nProblems found:")
    print("\n".join("  " + p for p in problems))
    sys.exit(1)
print("All checks passed.")
