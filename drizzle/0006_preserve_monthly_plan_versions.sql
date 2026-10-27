ALTER TABLE `monthly_plan_items` ADD `version` int DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- Stamp existing live items with the plan version they currently represent.
UPDATE `monthly_plan_items` AS item
JOIN `monthly_plans` AS plan ON plan.`id` = item.`planId`
SET item.`version` = plan.`version`;
