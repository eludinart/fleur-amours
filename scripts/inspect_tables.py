import os
from pathlib import Path

env_path = Path(__file__).resolve().parents[1] / ".env"
for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    os.environ.setdefault(k.strip(), v.strip())

import pymysql

conn = pymysql.connect(
    host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", 3306)),
    db=os.getenv("DB_NAME"), user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"), charset="utf8mb4"
)

tables = [
    "wp_ritual_campaigns",
    "wp_ritual_definitions",
    "wp_ritual_participants",
    "wp_ritual_tokens",
    "wp_ritual_questions",
    "wp_ritual_question_choices",
    "wp_ritual_answers",
    "wp_ritual_results",
    "wp_fleur_amour_results",
]

with conn.cursor() as cur:
    for t in tables:
        cur.execute(f"DESCRIBE `{t}`")
        cols = [(r[0], r[1]) for r in cur.fetchall()]
        print(f"\n-- {t}")
        for col, typ in cols:
            print(f"   {col:35s} {typ}")

conn.close()
