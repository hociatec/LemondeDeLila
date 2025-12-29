-- Création DB + user de dev pour "Le Monde de Lila".
-- Usage :
--   sudo mysql < backend/tools/sql/create-db-user.mysql.sql

CREATE DATABASE IF NOT EXISTS le_monde_de_lila
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'lila'@'%' IDENTIFIED BY 'lila';
GRANT ALL PRIVILEGES ON le_monde_de_lila.* TO 'lila'@'%';
FLUSH PRIVILEGES;
