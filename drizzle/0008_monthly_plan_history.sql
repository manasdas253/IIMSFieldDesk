CREATE TABLE `monthly_plan_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `planId` int NOT NULL,
  `empCode` varchar(20) NOT NULL,
  `planDate` date NOT NULL,
  `changedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `oldValue` text NOT NULL,
  `newValue` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `monthly_plan_history_plan_idx` (`planId`),
  KEY `monthly_plan_history_employee_idx` (`empCode`),
  CONSTRAINT `monthly_plan_history_plan_fk` FOREIGN KEY (`planId`) REFERENCES `monthly_plans` (`id`) ON DELETE CASCADE
);