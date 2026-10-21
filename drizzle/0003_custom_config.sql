CREATE TABLE `caddy_custom_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "caddy_custom_config_single_row" CHECK("caddy_custom_config"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE `config_revisions` ADD `custom_content` text;