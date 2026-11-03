ALTER TABLE `employees` ADD `officialWorkEmail` varchar(320);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_official_work_email_uq` ON `employees` (`officialWorkEmail`);
