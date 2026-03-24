"""Test de connexion MySQL — à lancer depuis la racine du workspace."""
import os, sys
from pathlib import Path

# Charger .env manuellement (sans dépendance externe)
env_path = Path(__file__).resolve().parents[1] / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())

import pymysql

host   = os.getenv("DB_HOST", "localhost")
port   = int(os.getenv("DB_PORT", "3306"))
db     = os.getenv("DB_NAME", "")
user   = os.getenv("DB_USER", "")
pwd    = os.getenv("DB_PASSWORD", "")
prefix = os.getenv("DB_PREFIX", "wp_")

print(f"Host     : {host}:{port}")
print(f"Database : {db}")
print(f"User     : {user}")
print(f"Prefix   : {prefix}")
print()

try:
    conn = pymysql.connect(
        host=host, port=port, db=db,
        user=user, password=pwd,
        connect_timeout=10,
        charset="utf8mb4",
    )
    print("[OK] Connexion MySQL : OK")

    with conn.cursor() as cur:
        cur.execute("SELECT VERSION()")
        version = cur.fetchone()[0]
        print(f"[OK] Version MySQL   : {version}")

        tables_to_check = [
            f"{prefix}fleur_amour_results",
            f"{prefix}ritual_definitions",
            f"{prefix}ritual_campaigns",
            f"{prefix}ritual_participants",
            f"{prefix}ritual_tokens",
            f"{prefix}ritual_questions",
            f"{prefix}ritual_question_choices",
            f"{prefix}ritual_answers",
            f"{prefix}ritual_results",
        ]

        cur.execute("SHOW TABLES")
        existing = {r[0] for r in cur.fetchall()}
        print(f"\n[OK] Tables dans '{db}' : {len(existing)} table(s) trouvee(s)\n")

        found, missing = [], []
        for t in tables_to_check:
            if t in existing:
                cur.execute(f"SELECT COUNT(*) FROM `{t}`")
                n = cur.fetchone()[0]
                found.append((t, n))
            else:
                missing.append(t)

        if found:
            print("  Tables trouvees :")
            for t, n in found:
                print(f"    [OK] {t}  ({n} ligne(s))")
        if missing:
            print("\n  Tables manquantes (a creer via les plugins WordPress) :")
            for t in missing:
                print(f"    [MISSING] {t}")

    conn.close()

except pymysql.err.OperationalError as e:
    print(f"[ECHEC] Connexion echouee : {e}")
    sys.exit(1)
except Exception as e:
    print(f"[ECHEC] Erreur : {e}")
    sys.exit(1)
