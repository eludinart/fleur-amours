"""
Migration 001 — Création de la table wp_fleur_amour_answers.

Stocke les réponses brutes aux questionnaires Fleur individuels et DUO.
Permet :
  - Audit complet de chaque passation
  - Recalcul des scores si la logique évolue
  - Statistiques par question
"""
import os
from pathlib import Path

env_path = Path(__file__).resolve().parents[2] / ".env"
for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    os.environ.setdefault(k.strip(), v.strip())

import pymysql

PREFIX = os.getenv("DB_PREFIX", "wp_")

CREATE_SQL = f"""
CREATE TABLE IF NOT EXISTS `{PREFIX}fleur_amour_answers` (
    `id`                BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `result_id`         BIGINT(20) UNSIGNED NOT NULL COMMENT 'FK vers wp_fleur_amour_results.id',
    `definition_id`     BIGINT(20) UNSIGNED NOT NULL COMMENT 'FK vers wp_ritual_definitions.id',
    `question_id`       BIGINT(20) UNSIGNED NOT NULL COMMENT 'FK vers wp_ritual_questions.id',
    `question_position` SMALLINT  NOT NULL DEFAULT 0,
    `dimension_chosen`  VARCHAR(40) NOT NULL COMMENT 'Petal choisi (ex: Agape, Eros...)',
    `choice_label`      TEXT COMMENT 'Libellé du choix tel que présenté',
    `created_at`        DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_result_id`     (`result_id`),
    INDEX `idx_definition_id` (`definition_id`),
    INDEX `idx_question_id`   (`question_id`),
    INDEX `idx_dimension`     (`dimension_chosen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Réponses brutes aux questionnaires Fleur d AmOurs';
"""

def run():
    conn = pymysql.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", 3306)),
        db=os.getenv("DB_NAME"), user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"), charset="utf8mb4"
    )
    try:
        with conn.cursor() as cur:
            cur.execute(CREATE_SQL)
            conn.commit()
            cur.execute(f"DESCRIBE `{PREFIX}fleur_amour_answers`")
            cols = [r[0] for r in cur.fetchall()]
            print(f"[OK] Table {PREFIX}fleur_amour_answers : {cols}")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
