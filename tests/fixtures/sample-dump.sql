-- phpMyAdmin SQL Dump
-- version 5.2.3
-- Host: localhost
-- Server version: 10.11.0-MariaDB

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8mb4 */;

CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `plan` varchar(255) NOT NULL DEFAULT 'free',
  `tutorial_dismissed_at` timestamp NULL DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `remember_token` varchar(100) DEFAULT NULL,
  `provider` varchar(255) DEFAULT NULL,
  `provider_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `name`, `email`, `email_verified_at`, `password`, `plan`, `tutorial_dismissed_at`, `is_admin`, `remember_token`, `provider`, `provider_id`, `created_at`, `updated_at`, `deleted_at`) VALUES
(3, 'O\'Brien\\研究員\n次行', 'obrien@example.com', '2026-01-01 01:02:03', '$2y$fictional', 'free', NULL, 1, 'remember-3', NULL, NULL, '2026-01-01 01:02:03', '2026-01-02 01:02:03', NULL),
(8, 'Google ユーザー', 'google@example.com', NULL, NULL, 'free', NULL, 0, NULL, 'google', 'fictional-google-8', '2026-01-03 00:00:00', '2026-01-03 00:00:00', NULL),
(12, '退会済み', 'deleted@example.com', NULL, '$2y$fictional', 'unlimited', '2026-01-04 00:00:00', 0, NULL, NULL, NULL, '2026-01-01 00:00:00', '2026-01-04 00:00:00', '2026-01-05 00:00:00');

CREATE TABLE `user_settings` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `theme` varchar(255) NOT NULL,
  `dark_mode` varchar(255) NOT NULL,
  `show_remaining_tasks` tinyint(1) NOT NULL,
  `show_elapsed_time` tinyint(1) NOT NULL,
  `show_celebration` tinyint(1) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `user_settings` (`id`, `user_id`, `theme`, `dark_mode`, `show_remaining_tasks`, `show_elapsed_time`, `show_celebration`, `created_at`, `updated_at`) VALUES
(1, 3, 'soft', 'system', 1, 0, 1, '2026-01-01 01:02:03', '2026-01-02 01:02:03'),
(2, 8, 'light', 'off', 0, 1, 0, NULL, NULL);

CREATE TABLE `routines` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `tasks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`tasks`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `routines` (`id`, `user_id`, `title`, `tasks`, `created_at`, `updated_at`) VALUES
(10, 3, '朝の\"支度\"', '[\"歯みがき\",\"着替え\"]', '2026-01-01 02:00:00', '2026-01-01 02:00:00'),
(15, 8, '夕方', '[\"休憩\",\"日記\"]', NULL, NULL);

CREATE TABLE `histories` (
  `id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `routine_id` bigint(20) unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `tasks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`tasks`)),
  `started_at` timestamp NOT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `histories` (`id`, `user_id`, `routine_id`, `title`, `tasks`, `started_at`, `finished_at`, `completed`, `created_at`, `updated_at`) VALUES
(21, 3, 10, '朝の支度', '[\"歯みがき\",\"着替え\"]', '2026-01-02 00:00:00', '2026-01-02 00:10:00', 1, NULL, NULL),
(22, 8, 15, '夕方', '[\"休憩\",\"日記\"]', '2026-01-03 00:00:00', NULL, 0, NULL, NULL),
(23, 3, 10, '朝の支度', '[\"歯みがき\"]', '2026-01-04 00:00:00', '2026-01-04 00:03:00', 0, NULL, NULL);

INSERT INTO `sessions` (`id`, `payload`) VALUES
('session-1', 'fictional');
INSERT INTO `cache` (`key`, `value`) VALUES
('a', 'b');
INSERT INTO `migrations` (`id`, `migration`) VALUES
(1, 'create_users');
INSERT INTO `password_reset_tokens` (`email`, `token`) VALUES
('ignored@example.com', 'fictional');

ALTER TABLE `users` ADD PRIMARY KEY (`id`);
ALTER TABLE `user_settings` ADD PRIMARY KEY (`id`);
ALTER TABLE `routines` ADD PRIMARY KEY (`id`);
ALTER TABLE `histories` ADD PRIMARY KEY (`id`);
ALTER TABLE `users` MODIFY `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT;
ALTER TABLE `user_settings` MODIFY `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT;
ALTER TABLE `routines` MODIFY `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT;
ALTER TABLE `histories` MODIFY `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT;
ALTER TABLE `routines` ADD CONSTRAINT `routines_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `histories` ADD CONSTRAINT `histories_routine_id_foreign` FOREIGN KEY (`routine_id`) REFERENCES `routines` (`id`);
COMMIT;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
