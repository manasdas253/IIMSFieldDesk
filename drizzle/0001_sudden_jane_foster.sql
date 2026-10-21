CREATE TABLE `planned_visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`customerName` varchar(180) NOT NULL,
	`location` varchar(160) NOT NULL,
	`purpose` enum('New Lead','Follow-up','Service','Collection','Other') NOT NULL,
	`applyForTicket` boolean NOT NULL DEFAULT false,
	`travelMode` enum('Own Vehicle','Train','Flight','Cab','Other'),
	`routeFrom` varchar(120),
	`routeTo` varchar(120),
	`preferredDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `planned_visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `field_visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeName` varchar(120) NOT NULL,
	`visitDate` date NOT NULL,
	`customerName` varchar(180) NOT NULL,
	`location` varchar(160) NOT NULL,
	`purpose` enum('New Lead','Follow-up','Service','Collection','Other') NOT NULL,
	`travelMode` enum('Own Vehicle','Train','Flight','Cab','Other') NOT NULL,
	`distanceKm` decimal(10,2) NOT NULL DEFAULT '0',
	`travelCost` decimal(12,2) NOT NULL DEFAULT '0',
	`outcome` varchar(80) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `field_visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeName` varchar(120) NOT NULL,
	`weekStartingDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `planned_visits` ADD CONSTRAINT `planned_visits_planId_weekly_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `weekly_plans`(`id`) ON DELETE cascade ON UPDATE no action;