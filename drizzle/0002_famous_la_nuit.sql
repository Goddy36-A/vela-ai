CREATE TABLE `agent_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`actionDescription` longtext NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`prompt` longtext NOT NULL,
	`cronSchedule` varchar(64),
	`enabled` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` longtext NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_memories_id` PRIMARY KEY(`id`)
);
