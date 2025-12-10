-- Schéma complet minimal pour le backend NestJS (MySQL).
-- Tables : users, chat_messages, messaging_private_messages, rooms, room_participants, room_bots, bot_names.
-- Exécuter sur la base cible (ex. le_monde_de_lila) :
--   mysql -u <user> -p<password> le_monde_de_lila < backend/tools/sql/full-schema.mysql.sql

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(180) NOT NULL,
  `roles` json NOT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `preferences` json DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT 0,
  `banned_until` datetime DEFAULT NULL,
  `ban_reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_email` (`email`),
  UNIQUE KEY `uniq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message_id` varchar(36) NOT NULL,
  `message` longtext NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_chat_messages_message_id` (`message_id`),
  KEY `idx_chat_messages_created_at` (`created_at`),
  CONSTRAINT `FK_chat_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messaging_private_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `recipient_id` int NOT NULL,
  `message_id` varchar(36) NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_by_sender_at` datetime DEFAULT NULL,
  `deleted_by_recipient_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_messaging_private_messages_message_id` (`message_id`),
  KEY `idx_messaging_private_messages_created_at` (`created_at`),
  KEY `idx_messaging_private_messages_sender` (`sender_id`),
  KEY `idx_messaging_private_messages_recipient` (`recipient_id`),
  CONSTRAINT `FK_messaging_pm_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_messaging_pm_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `game_type` varchar(100) NOT NULL,
  `max_players` int NOT NULL DEFAULT 4,
  `is_private` tinyint(1) NOT NULL DEFAULT 1,
  `status` varchar(50) NOT NULL DEFAULT 'setup',
  `owner_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_rooms_owner` (`owner_id`),
  CONSTRAINT `FK_rooms_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `room_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `room_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'player',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `left_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_room_participants_room` (`room_id`),
  KEY `IDX_room_participants_user` (`user_id`),
  KEY `IDX_room_participants_left_at` (`left_at`),
  CONSTRAINT `FK_room_participants_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_room_participants_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `room_bots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `room_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_room_bots_room` (`room_id`),
  CONSTRAINT `FK_room_bots_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bot_names` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_bot_names_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Noms de bots par défaut (liste thématique).
INSERT INTO `bot_names` (`name`, `enabled`)
VALUES
  ('BibiBarrique', 1),
  ('GrogMatic', 1),
  ('Tavernicus', 1),
  ('Bidouillard', 1),
  ('MousseMecanique', 1),
  ('BourraBot', 1),
  ('TonneauTron', 1),
  ('Farfouillex', 1),
  ('GagaGolem', 1),
  ('MarmiteRoulante', 1),
  ('CouscousKran', 1),
  ('GnoleGear', 1),
  ('Picolotron', 1),
  ('FutFou', 1),
  ('Ivre-Tonique', 1),
  ('Barbotine', 1),
  ('ChopineX', 1),
  ('Gargouillix', 1),
  ('TroubadourBot', 1),
  ('Fiascobot', 1),
  ('Brasse-Bouze', 1),
  ('Caskouille', 1),
  ('Fripouille5000', 1),
  ('CervoMousse', 1),
  ('BazarBorg', 1),
  ('Poivrotix', 1),
  ('CraquelinBot', 1),
  ('Loqueteux', 1),
  ('Grelottin', 1),
('Soupe-a-Bot', 1)
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);

-- Mise à niveau si la table users existe déjà (ajout des colonnes de ban).
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `banned_until` datetime NULL,
  ADD COLUMN IF NOT EXISTS `ban_reason` varchar(255) NULL;
