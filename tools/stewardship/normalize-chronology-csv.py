#!/usr/bin/env python3
"""Normalize existing historical-consistency CSV to an explicitly unverified JSON array."""
import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: normalize-chronology-csv.py findings.csv normalized.json")
with Path(sys.argv[1]).open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    if reader.fieldnames != ["level", "issue", "subject", "evidence"]:
        raise ValueError("Unexpected historical consistency CSV header")
    rows = []
    for row in reader:
        if len(rows) >= 10000:
            raise ValueError("Too many chronology rows")
        if row["level"] not in ("review", "inventory"):
            raise ValueError("Unsupported chronology level")
        issue, subject = row["issue"], row["subject"]
        if not issue or len(issue) > 200 or not subject or len(subject) > 200:
            raise ValueError("Missing or oversized issue/subject")
        # Evidence stays in the authoritative CSV, never copied to dashboard.
        rows.append({"level": row["level"], "issue": issue, "subject": subject})
Path(sys.argv[2]).write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
print(f"Normalized {len(rows)} chronology review candidates; group findings are not automatically assigned")
