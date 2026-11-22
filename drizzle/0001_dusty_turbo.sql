CREATE TABLE `chapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`novelId` int NOT NULL,
	`chapterNumber` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` longtext NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chapters_id` PRIMARY KEY(`id`),
	CONSTRAINT `chapters_novel_number_unique` UNIQUE(`novelId`,`chapterNumber`)
);
--> statement-breakpoint
CREATE TABLE `novels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`title` varchar(180) NOT NULL,
	`author` varchar(160) NOT NULL,
	`genre` enum('Fantasy','Action','Romance','Sci-Fi') NOT NULL,
	`coverUrl` text,
	`synopsis` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `novels_id` PRIMARY KEY(`id`),
	CONSTRAINT `novels_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `chapters` ADD CONSTRAINT `chapters_novelId_novels_id_fk` FOREIGN KEY (`novelId`) REFERENCES `novels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chapters_novel_status_number_idx` ON `chapters` (`novelId`,`status`,`chapterNumber`);