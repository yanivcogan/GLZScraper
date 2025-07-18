CREATE DATABASE `glz_archive` /*!40100 DEFAULT CHARACTER SET utf8mb3 */ /*!80016 DEFAULT ENCRYPTION='N' */;

CREATE TABLE `episode` (
  `id` int NOT NULL AUTO_INCREMENT,
  `channel_id` int NOT NULL DEFAULT '0',
  `programme_id_on_channel` int NOT NULL,
  `episode_id_on_channel` int NOT NULL,
  `page_url` varchar(2000) DEFAULT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `air_date` date NOT NULL,
  `runtime` int DEFAULT NULL,
  `data` longtext,
  `download_status` enum('not downloaded','in progress','error','downloaded') NOT NULL DEFAULT 'not downloaded',
  `err_msg` varchar(500) DEFAULT NULL,
  `local_storage` json DEFAULT NULL,
  `content_hash` varchar(150) DEFAULT NULL,
  `duplicate_of` int DEFAULT NULL,
  `drive_url` json DEFAULT NULL,
  `transcripts` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_episode_guarantee` (`channel_id`,`programme_id_on_channel`,`episode_id_on_channel`),
  FULLTEXT KEY `transcripts_search` (`transcripts`)
) ENGINE=MyISAM AUTO_INCREMENT=5300 DEFAULT CHARSET=utf8mb3;

CREATE TABLE `highlights` (
  `id` int NOT NULL AUTO_INCREMENT,
  `create_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `episode_id` int DEFAULT NULL,
  `range` json NOT NULL,
  `original_text` text COLLATE utf8mb4_general_ci NOT NULL,
  `fixed_text` text COLLATE utf8mb4_general_ci,
  `speaker_name` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(1000) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `programme` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(500) NOT NULL,
  `url` varchar(1000) NOT NULL,
  `glz_id` int DEFAULT NULL,
  `data` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `glz_id` (`glz_id`)
) ENGINE=MyISAM AUTO_INCREMENT=248 DEFAULT CHARSET=utf8mb3;

