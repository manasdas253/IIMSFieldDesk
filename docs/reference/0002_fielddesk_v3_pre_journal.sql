ALTER TABLE `field_visits` ADD COLUMN `empCode` varchar(20) NULL;
CREATE INDEX `field_visits_empCode_idx` ON `field_visits` (`empCode`);
ALTER TABLE `weekly_plans` ADD COLUMN `empCode` varchar(20) NULL;
CREATE INDEX `weekly_plans_empCode_idx` ON `weekly_plans` (`empCode`);

CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empCode` varchar(20) NOT NULL,
  `employeeName` varchar(120) NOT NULL,
  `designation` varchar(120) NULL,
  `department` varchar(120) NULL,
  `mobile` varchar(32) NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employees_empCode_uq` (`empCode`),
  KEY `employees_active_idx` (`isActive`)
);

CREATE TABLE `monthly_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empCode` varchar(20) NOT NULL,
  `employeeName` varchar(120) NOT NULL,
  `planMonth` varchar(7) NOT NULL,
  `status` enum('Draft','Submitted') NOT NULL DEFAULT 'Submitted',
  `version` int NOT NULL DEFAULT 1,
  `submittedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `monthly_plans_emp_month_uq` (`empCode`,`planMonth`),
  KEY `monthly_plans_month_idx` (`planMonth`)
);

CREATE TABLE `monthly_plan_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `planId` int NOT NULL,
  `plannedDate` date NOT NULL,
  `customerName` varchar(180) NOT NULL,
  `location` varchar(160) NOT NULL,
  `purpose` enum('New Lead','Follow-up','Service','Collection','Other') NOT NULL,
  `applyForTicket` boolean NOT NULL DEFAULT false,
  `travelMode` enum('Own Vehicle','Train','Flight','Cab','Other') NULL,
  `routeFrom` varchar(120) NULL,
  `routeTo` varchar(120) NULL,
  `preferredDate` date NULL,
  `remarks` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `monthly_items_plan_date_idx` (`planId`,`plannedDate`),
  CONSTRAINT `monthly_plan_items_plan_fk` FOREIGN KEY (`planId`) REFERENCES `monthly_plans` (`id`) ON DELETE CASCADE
);

CREATE TABLE `follow_ups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visitId` int NOT NULL,
  `empCode` varchar(20) NULL,
  `customerName` varchar(180) NOT NULL,
  `followUpDate` date NOT NULL,
  `followUpTime` varchar(8) NULL,
  `note` text NULL,
  `status` enum('Pending','Done','Rescheduled','Cancelled') NOT NULL DEFAULT 'Pending',
  `completedAt` timestamp NULL,
  `completedVisitId` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `followups_emp_date_status_idx` (`empCode`,`followUpDate`,`status`),
  CONSTRAINT `follow_ups_visit_fk` FOREIGN KEY (`visitId`) REFERENCES `field_visits` (`id`) ON DELETE CASCADE
);

CREATE TABLE `plan_holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `holidayDate` date NOT NULL,
  `name` varchar(160) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plan_holidays_date_uq` (`holidayDate`)
);

CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empCode` varchar(20) NOT NULL,
  `endpoint` varchar(500) NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `push_subscriptions_endpoint_uq` (`endpoint`),
  KEY `push_subscriptions_emp_idx` (`empCode`)
);
