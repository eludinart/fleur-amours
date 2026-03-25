-- Fleur d'AmOurs — Sève SAP (wallet + ledger)
-- Préfixe : adapter wp_ si besoin (DB_PREFIX).
-- Exécuter une fois sur MariaDB.

CREATE TABLE IF NOT EXISTS wp_fleur_sap_wallets (
  user_id INT NOT NULL PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wp_fleur_sap_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  type ENUM('purchase', 'usage', 'bonus') NOT NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optionnel : colonne WordPress (ignorer l'erreur si la colonne existe déjà).
-- ALTER TABLE wp_users ADD COLUMN is_coach TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS wp_fleur_stripe_webhook_events (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wp_fleur_sap_bonus_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NOT NULL,
  patient_user_id INT NOT NULL,
  amount INT NOT NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_actor_time (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
