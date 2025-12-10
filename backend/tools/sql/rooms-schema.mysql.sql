-- Schéma minimal pour les tables room utilisées par NestJS.
-- Exécuter ce script sur la base MySQL ciblée (ex. le_monde_de_lila).

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
