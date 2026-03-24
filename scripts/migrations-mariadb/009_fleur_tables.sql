-- ============================================================
-- Migration 009 — Tables Fleur pour MariaDB (VPS / Next.js)
-- À exécuter si MariaDB est configuré sans sync depuis MySQL.
-- Usage: mysql -u user -p database < scripts/migrations-mariadb/009_fleur_tables.sql
-- ============================================================
-- Préfixe: wp_ (ou DB_PREFIX dans .env)
-- Ces tables sont créées par le PHP sur Hostinger; sur VPS,
-- préférer: npm run sync:db (copie complète MySQL → MariaDB).
-- ============================================================

-- Liens manuels entre jardiniers (Prairie)
CREATE TABLE IF NOT EXISTS wp_fleur_prairie_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_a INT NOT NULL,
    user_b INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pair (user_a, user_b),
    CHECK (user_a < user_b)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Événements rosée (arrosage entre jardiniers)
CREATE TABLE IF NOT EXISTS wp_fleur_rosee_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    amount INT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_to_user (to_user_id, created_at),
    INDEX idx_from_user (from_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
