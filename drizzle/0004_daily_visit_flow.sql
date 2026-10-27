CREATE TABLE `daily_visit_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empCode` varchar(20) NOT NULL,
	`employeeName` varchar(120) NOT NULL,
	`visitDate` date NOT NULL,
	`originalPlannedDate` date,
	`plannedVisitId` int,
	`parentStatusId` int,
	`customerName` varchar(180) NOT NULL,
	`location` varchar(160) NOT NULL,
	`purpose` enum('New Lead','Follow-up','Service','Collection','Other') NOT NULL,
	`source` enum('Planned','Unplanned') NOT NULL DEFAULT 'Planned',
	`status` enum('Planned','Visited','Missed','Rescheduled') NOT NULL,
	`reason` enum('Customer unavailable','Rescheduled','Internal work','Leave','Other'),
	`outcome` varchar(80),
	`notes` text,
	`newDate` date,
	`visitId` int,
	`followUpId` int,
	`lateEntry` boolean NOT NULL DEFAULT false,
	`mergedIntoStatusId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_visit_statuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `followUpPurpose` varchar(500);--> statement-breakpoint
ALTER TABLE `field_visits` ADD `source` enum('Planned','Unplanned');--> statement-breakpoint
CREATE INDEX `daily_status_emp_date_idx` ON `daily_visit_statuses` (`empCode`,`visitDate`);--> statement-breakpoint
CREATE INDEX `daily_status_planned_visit_idx` ON `daily_visit_statuses` (`plannedVisitId`);--> statement-breakpoint
CREATE INDEX `daily_status_parent_idx` ON `daily_visit_statuses` (`parentStatusId`);