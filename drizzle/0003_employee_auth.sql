ALTER TABLE `employees` ADD `role` enum('employee','admin') DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `employees` ADD `mustChangePassword` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `lastLoginAt` timestamp;