-- =============================================================================
-- Migration v0.7 — Fleur d'AmOurs
-- Date    : 2026-03-29
-- Préfixe : wp_fleur_  (conforme à DB_PREFIX=wp_)
--
-- Nouvelles tables :
--   wp_fleur_sessions            (sessions de tirage)
--   wp_fleur_promo_codes         (définition des codes promo)
--   wp_fleur_promo_redemptions   (historique d'utilisation)
--   wp_fleur_contact_messages    (formulaire de contact)
--
-- Colonnes ajoutées :
--   wp_fleur_sessions.user_id    (liaison FK avec wp_users)
--
-- Sécurité :
--   Toutes les tables utilisent InnoDB + utf8mb4.
--   Les clés uniques empêchent la double utilisation des codes promo.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;

-- ---------------------------------------------------------------------------
-- 1. Sessions de tirage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wp_fleur_sessions (
  id                 INT          NOT NULL AUTO_INCREMENT,
  email              VARCHAR(255) DEFAULT NULL,
  user_id            INT          DEFAULT NULL COMMENT 'Référence wp_users.ID (nullable pour compat legacy)',
  first_words        TEXT,
  door_suggested     VARCHAR(50)  DEFAULT NULL,
  petals_json        TEXT,
  history_json       MEDIUMTEXT,
  cards_json         TEXT,
  anchors_json       TEXT,
  plan14j_json       TEXT,
  step_data_json     MEDIUMTEXT   DEFAULT NULL,
  doors_locked       VARCHAR(255) DEFAULT NULL,
  turn_count         INT          NOT NULL DEFAULT 0,
  status             VARCHAR(20)  NOT NULL DEFAULT 'completed',
  duration_seconds   INT          NOT NULL DEFAULT 0,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_email      (email),
  INDEX idx_user_id    (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter user_id si la table existe déjà sans cette colonne
ALTER TABLE wp_fleur_sessions
  ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL AFTER email;

-- ---------------------------------------------------------------------------
-- 2. Codes promotionnels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wp_fleur_promo_codes (
  id           INT          NOT NULL AUTO_INCREMENT,
  code         VARCHAR(100) NOT NULL COMMENT 'Stocké en MAJUSCULES',
  description  VARCHAR(255) DEFAULT NULL,
  sap_amount   INT          NOT NULL DEFAULT 0 COMMENT 'SAP crédités à l''utilisation',
  max_uses     INT          DEFAULT NULL COMMENT 'NULL = illimité',
  use_count    INT          NOT NULL DEFAULT 0,
  expires_at   DATETIME     DEFAULT NULL COMMENT 'NULL = pas d''expiration',
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   INT          DEFAULT NULL COMMENT 'user_id de l''admin créateur',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code),
  INDEX idx_active     (is_active),
  INDEX idx_expires    (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Historique des utilisations de codes promo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wp_fleur_promo_redemptions (
  id           INT      NOT NULL AUTO_INCREMENT,
  code_id      INT      NOT NULL,
  user_id      INT      NOT NULL,
  sap_credited INT      NOT NULL DEFAULT 0,
  redeemed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_code_user (code_id, user_id) COMMENT 'Un utilisateur ne peut utiliser un code qu''une seule fois',
  INDEX idx_user_id    (user_id),
  INDEX idx_code_id    (code_id),
  INDEX idx_redeemed   (redeemed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. Messages de contact
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wp_fleur_contact_messages (
  id          INT          NOT NULL AUTO_INCREMENT,
  user_id     INT          DEFAULT NULL COMMENT 'NULL si visiteur non connecté',
  email       VARCHAR(255) NOT NULL,
  name        VARCHAR(255) DEFAULT NULL,
  subject     VARCHAR(255) DEFAULT NULL,
  message     TEXT         NOT NULL,
  status      ENUM('new','read','replied','closed') NOT NULL DEFAULT 'new',
  ip_address  VARCHAR(45)  DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status     (status),
  INDEX idx_user_id    (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Données d'amorçage (optionnel — exemple de code promo de test)
-- ---------------------------------------------------------------------------
-- INSERT IGNORE INTO wp_fleur_promo_codes (code, description, sap_amount, max_uses)
-- VALUES ('BIENVENUE2026', 'Code de bienvenue', 50, 1000);

SET foreign_key_checks = 1;
-- FIN DE LA MIGRATION v0.7
