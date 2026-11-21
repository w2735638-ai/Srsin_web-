CREATE TABLE `chapter_unlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`chapterId` int NOT NULL,
	`coinsCharged` int NOT NULL DEFAULT 15,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chapter_unlocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `chapter_unlock_account_chapter_unique` UNIQUE(`accountId`,`chapterId`)
);
--> statement-breakpoint
CREATE TABLE `coin_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`chapterId` int,
	`kind` enum('admin_topup','chapter_unlock') NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`note` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coin_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reader_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`coins` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastLoginAt` timestamp,
	CONSTRAINT `reader_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `reader_accounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `reader_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reader_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `reader_sessions_token_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `chapters` ADD `isPaid` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `chapter_unlocks` ADD CONSTRAINT `chapter_unlocks_accountId_reader_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `reader_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chapter_unlocks` ADD CONSTRAINT `chapter_unlocks_chapterId_chapters_id_fk` FOREIGN KEY (`chapterId`) REFERENCES `chapters`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coin_transactions` ADD CONSTRAINT `coin_transactions_accountId_reader_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `reader_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coin_transactions` ADD CONSTRAINT `coin_transactions_chapterId_chapters_id_fk` FOREIGN KEY (`chapterId`) REFERENCES `chapters`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reader_sessions` ADD CONSTRAINT `reader_sessions_accountId_reader_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `reader_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chapter_unlock_chapter_idx` ON `chapter_unlocks` (`chapterId`);--> statement-breakpoint
CREATE INDEX `coin_transactions_account_time_idx` ON `coin_transactions` (`accountId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `coin_transactions_chapter_idx` ON `coin_transactions` (`chapterId`);--> statement-breakpoint
CREATE INDEX `reader_sessions_account_expiry_idx` ON `reader_sessions` (`accountId`,`expiresAt`);