#!/usr/bin/env python3
"""
Extrait les 65 cartes du PDF Fleur d'AmOurs en images PNG.
Source: FRAMEWORK DOCS/carte tarot fleur d'amours 65 cartes .pdf
Destination: FRAMEWORK DOCS/CARTES/
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "FRAMEWORK DOCS" / "carte tarot fleur d'amours 65 cartes .pdf"
OUT_DIR = ROOT / "FRAMEWORK DOCS" / "CARTES"
INDEX_PATH = ROOT / "FRAMEWORK SCIENCE" / "structured_cards" / "index.json"


def get_card_slugs():
    """Retourne la liste des noms de fichiers (sans .json) pour les 65 cartes."""
    data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    return [Path(c["file"]).stem for c in data.get("cards", []) if c.get("file")]


def main():
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("Installez PyMuPDF: pip install pymupdf")
        return 1

    if not PDF_PATH.exists():
        print(f"PDF introuvable: {PDF_PATH}")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    slugs = get_card_slugs()

    doc = fitz.open(PDF_PATH)
    npages = len(doc)
    print(f"PDF: {npages} pages, {len(slugs)} cartes attendues")

    for i in range(min(npages, len(slugs))):
        page = doc[i]
        pix = page.get_pixmap(dpi=150, alpha=False)
        base = slugs[i]  # ex: 01_agape
        out_path = OUT_DIR / f"{base}.png"
        pix.save(str(out_path))
        print(f"  {i+1}/65 -> {out_path.name}")

    doc.close()
    print(f"\nTerminé. Cartes extraites dans: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    exit(main())
