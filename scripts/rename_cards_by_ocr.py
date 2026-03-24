#!/usr/bin/env python3
"""
Lit le nom inscrit sur chaque image de carte via OCR,
puis renomme les fichiers et met a jour les mappings.
Utilise EasyOCR (sans binaire externe) ou Tesseract si installe.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARTES_DIR = ROOT / "FRAMEWORK DOCS" / "CARTES"
INDEX_PATH = ROOT / "FRAMEWORK SCIENCE" / "structured_cards" / "index.json"
MAPPING_PATH = ROOT / "FRAMEWORK DOCS" / "CARTES" / "image_mapping.json"
SUBTITLE_FILTER = "les pétales de la fleur"


def slugify(name: str) -> str:
    """Convertit un nom en slug pour fichier: AGAPÈ -> agape, L'EAU -> l_eau"""
    if not name or not name.strip():
        return ""
    s = name.strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[''\"]", "", s)
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "_", s)
    return s.lower().strip("_")


def _pick_card_name(texts: list) -> str:
    """Choisit la ligne la plus probable etre le nom de la carte."""
    for ln in texts:
        ln = ln.strip()
        if not ln or len(ln) > 45:
            continue
        if ln.lower().startswith(SUBTITLE_FILTER):
            continue
        if 2 < len(ln) < 50:
            return ln
    return texts[0].strip() if texts else ""


def _ocr_easyocr(img_path: Path, reader) -> str:
    """OCR via EasyOCR."""
    try:
        result = reader.readtext(str(img_path))
        texts = [r[1] for r in result if r[1].strip()]
        return _pick_card_name(texts)
    except Exception as e:
        print(f"  EasyOCR erreur: {e}")
        return ""


def _ocr_tesseract(img_path: Path) -> str:
    """OCR via Tesseract."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(img_path)
        img = img.convert("RGB")
        text = pytesseract.image_to_string(img, lang="fra+eng")
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        return _pick_card_name(lines)
    except Exception as e:
        print(f"  Tesseract erreur: {e}")
        return ""


def main():
    reader = None
    try:
        import easyocr
        reader = easyocr.Reader(["fr", "en"], gpu=False, verbose=False)
        ocr_fn = lambda p: _ocr_easyocr(p, reader)
        print("Utilisation de EasyOCR (fr+en)...")
    except ImportError:
        try:
            import pytesseract
            import sys
            if sys.platform == "win32":
                for path in [r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                             r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"]:
                    if Path(path).exists():
                        pytesseract.pytesseract.tesseract_cmd = path
                        break
            ocr_fn = _ocr_tesseract
            print("Utilisation de Tesseract...")
        except ImportError:
            print("Installez: pip install easyocr  (recommandé, sans binaire)")
            print("Ou: pip install pytesseract Pillow + Tesseract-OCR")
            return 1

    index_data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    mapping = {}
    renames = []

    for entry in index_data.get("cards", []):
        idx = entry.get("index")
        old_img = Path(entry.get("image", "")).name
        if not old_img.endswith(".png"):
            continue
        old_path = CARTES_DIR / old_img
        if not old_path.exists():
            print(f"  Ignore: {old_img} (absent)")
            continue

        name = ocr_fn(old_path)
        if not name:
            base = old_path.stem
            mapping[base] = base
            print(f"  {idx}: {old_img} -> OCR vide, conserve")
            continue

        slug = slugify(name)
        if not slug:
            slug = old_path.stem
        new_name = slug + ".png"
        new_path = CARTES_DIR / new_name

        if new_path == old_path:
            mapping[old_path.stem] = old_path.stem
            print(f"  {idx}: {old_img} (OCR: {name}) -> identique")
            continue

        if new_path.exists() and new_path != old_path:
            new_name = f"{idx:02d}_{slug}.png"
            new_path = CARTES_DIR / new_name

        old_path.rename(new_path)
        mapping[old_path.stem] = new_path.stem
        renames.append((str(old_path.name), str(new_path.name)))
        print(f"  {idx}: {old_img} -> {new_path.name} (OCR: {name})")

    MAPPING_PATH.parent.mkdir(parents=True, exist_ok=True)
    MAPPING_PATH.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")

    for entry in index_data["cards"]:
        old_full = entry.get("image", "")
        old_stem = Path(old_full).stem
        new_stem = mapping.get(old_stem, old_stem)
        entry["image"] = f"FRAMEWORK DOCS/CARTES/{new_stem}.png"

    INDEX_PATH.write_text(json.dumps(index_data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{len(renames)} fichier(s) renomme(s). Mapping: {MAPPING_PATH}")
    print("Relancez merge_all_cards.py puis redemarrez le serveur.")
    return 0


if __name__ == "__main__":
    exit(main())
