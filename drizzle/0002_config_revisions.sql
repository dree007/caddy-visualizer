CREATE TABLE `config_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`trigger` text NOT NULL,
	`source_revision_id` text,
	`config_content` text NOT NULL,
	`config_sha256` text NOT NULL,
	`sites_snapshot` text NOT NULL,
	`status` text NOT NULL,
	`expected_config_fingerprint` text,
	`error_message` text,
	`applied_at` integer,
	CONSTRAINT "config_revisions_status_check" CHECK("config_revisions"."status" in ('pending', 'loading', 'applied', 'failed', 'recovery-required'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `config_revisions_number_unique` ON `config_revisions` (`number`);--> statement-breakpoint
CREATE INDEX `config_revisions_status_idx` ON `config_revisions` (`status`);