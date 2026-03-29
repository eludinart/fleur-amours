-- 011 — Ma Fleur 2-Beta + option science
-- Préfixe: adapter DB_PREFIX (ex. wp_)
-- Usage: mysql … < scripts/migrations-mariadb/011_fleur_beta_and_science.sql

CREATE TABLE IF NOT EXISTS wp_fleur_beta_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    porte VARCHAR(32) NOT NULL,
    questionnaire_version VARCHAR(32) NOT NULL DEFAULT '2-beta',
    agape DECIMAL(8,6) NOT NULL DEFAULT 0,
    philautia DECIMAL(8,6) NOT NULL DEFAULT 0,
    mania DECIMAL(8,6) NOT NULL DEFAULT 0,
    storge DECIMAL(8,6) NOT NULL DEFAULT 0,
    pragma DECIMAL(8,6) NOT NULL DEFAULT 0,
    philia DECIMAL(8,6) NOT NULL DEFAULT 0,
    ludus DECIMAL(8,6) NOT NULL DEFAULT 0,
    eros DECIMAL(8,6) NOT NULL DEFAULT 0,
    answers_json LONGTEXT NOT NULL,
    ai_interpretation_json LONGTEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Science config (si colonne absente)
ALTER TABLE wp_fleur_science_config ADD COLUMN include_fleur_beta TINYINT NOT NULL DEFAULT 1;
