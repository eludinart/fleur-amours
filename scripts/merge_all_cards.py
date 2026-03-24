#!/usr/bin/env python3
"""Merge all JSON cards from FRAMEWORK SCIENCE/structured_cards into RESULTAT/all_cards.json
Adds provenance and last_modified timestamps.
"""
import json
from pathlib import Path
from datetime import datetime
import jsonschema

SCHEMA_PATH = Path(__file__).resolve().parents[0] / "schema" / "card.schema.json"


ROOT = Path(__file__).resolve().parents[1]
CARDS_DIR = ROOT / "FRAMEWORK SCIENCE" / "structured_cards"
OUT_DIR = ROOT / "RESULTAT"
OUT_FILE = OUT_DIR / "all_cards.json"


def load_card(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    stat = path.stat()
    data.setdefault("meta", {})
    data["meta"]["source"] = str(path.as_posix())
    data["meta"]["last_modified"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
    slug = data.get("slug") or path.stem.split("_", 1)[-1]
    data["meta"]["image"] = slug + ".png"
    return data


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    schema = None
    if SCHEMA_PATH.exists():
        schema = json.loads(SCHEMA_PATH.read_text(encoding='utf-8'))
    errors = []
    for p in sorted(CARDS_DIR.glob("*.json")):
        if p.name == "index.json":
            continue
        try:
            card = load_card(p)
            if schema is not None:
                try:
                    jsonschema.validate(card, schema)
                except Exception as e:
                    errors.append({"file": str(p), "error": str(e)})
                    print(f"Validation failed for {p}: {e}")
                    continue
            cards.append(card)
        except Exception as e:
            print(f"Skipping {p}: {e}")

    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "count": len(cards),
        "cards": cards,
        "validation_errors": errors,
    }

    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_FILE} with {len(cards)} cards")


if __name__ == "__main__":
    main()
