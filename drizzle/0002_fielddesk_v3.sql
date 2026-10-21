CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empCode` varchar(20) NOT NULL,
	`employeeName` varchar(120) NOT NULL,
	`designation` varchar(120),
	`department` varchar(120),
	`mobile` varchar(32),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_empCode_uq` UNIQUE(`empCode`)
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`empCode` varchar(20),
	`customerName` varchar(180) NOT NULL,
	`followUpDate` date NOT NULL,
	`followUpTime` varchar(8),
	`note` text,
	`status` enum('Pending','Done','Rescheduled','Cancelled') NOT NULL DEFAULT 'Pending',
	`completedAt` timestamp,
	`completedVisitId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthly_plan_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`plannedDate` date NOT NULL,
	`customerName` varchar(180) NOT NULL,
	`location` varchar(160) NOT NULL,
	`purpose` enum('New Lead','Follow-up','Service','Collection','Other') NOT NULL,
	`applyForTicket` boolean NOT NULL DEFAULT false,
	`travelMode` enum('Own Vehicle','Train','Flight','Cab','Other'),
	`routeFrom` varchar(120),
	`routeTo` varchar(120),
	`preferredDate` date,
	`remarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monthly_plan_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthly_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empCode` varchar(20) NOT NULL,
	`employeeName` varchar(120) NOT NULL,
	`planMonth` varchar(7) NOT NULL,
	`status` enum('Draft','Submitted') NOT NULL DEFAULT 'Submitted',
	`version` int NOT NULL DEFAULT 1,
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `monthly_plans_emp_month_uq` UNIQUE(`empCode`,`planMonth`)
);
--> statement-breakpoint
CREATE TABLE `plan_holidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`holidayDate` date NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_holidays_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_holidays_date_uq` UNIQUE(`holidayDate`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empCode` varchar(20) NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_subscriptions_endpoint_uq` UNIQUE(`endpoint`)
);
--> statement-breakpoint
ALTER TABLE `field_visits` ADD `empCode` varchar(20);--> statement-breakpoint
ALTER TABLE `weekly_plans` ADD `empCode` varchar(20);--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_visitId_field_visits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `field_visits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthly_plan_items` ADD CONSTRAINT `monthly_plan_items_planId_monthly_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `monthly_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `employees_active_idx` ON `employees` (`isActive`);--> statement-breakpoint
CREATE INDEX `followups_emp_date_status_idx` ON `follow_ups` (`empCode`,`followUpDate`,`status`);--> statement-breakpoint
CREATE INDEX `monthly_items_plan_date_idx` ON `monthly_plan_items` (`planId`,`plannedDate`);--> statement-breakpoint
CREATE INDEX `monthly_plans_month_idx` ON `monthly_plans` (`planMonth`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_emp_idx` ON `push_subscriptions` (`empCode`);--> statement-breakpoint
CREATE INDEX `field_visits_empCode_idx` ON `field_visits` (`empCode`);--> statement-breakpoint
CREATE INDEX `weekly_plans_empCode_idx` ON `weekly_plans` (`empCode`);