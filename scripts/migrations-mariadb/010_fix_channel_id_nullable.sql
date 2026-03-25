-- ============================================================
-- Migration 010 — Correction channel_id (fleur_notifications)
-- Erreur: "Field 'channel_id' doesn't have a default value"
--
-- À exécuter si vous voyez cette erreur lors d'un message Clairière.
-- Remplacer wp_ par votre DB_PREFIX (voir .env) si nécessaire.
--
-- Usage: mysql -u USER -p DATABASE < scripts/migrations-mariadb/010_fix_channel_id_nullable.sql
-- ============================================================

-- Rendre channel_id nullable (notifications sans canal)
ALTER TABLE wp_fleur_notifications MODIFY COLUMN channel_id INT NULL;

-- Idem pour les livraisons (ignorer si la colonne n'existe pas)
-- ALTER TABLE wp_fleur_notification_deliveries MODIFY COLUMN channel_id INT NULL;
