CREATE TABLE `access_log_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`host` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status` integer NOT NULL,
	`duration_ms` real NOT NULL,
	`bytes` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_log_entries_ts_idx` ON `access_log_entries` (`ts`);--> statement-breakpoint
CREATE INDEX `access_log_entries_host_ts_idx` ON `access_log_entries` (`host`,`ts`);--> statement-breakpoint
CREATE INDEX `access_log_entries_status_ts_idx` ON `access_log_entries` (`status`,`ts`);--> statement-breakpoint
CREATE TABLE `ingestion_cursors` (
	`path` text PRIMARY KEY NOT NULL,
	`dev` integer NOT NULL,
	`ino` integer NOT NULL,
	`fingerprint` text,
	`offset` integer NOT NULL,
	`lines_skipped` integer DEFAULT 0 NOT NULL,
	`gaps` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `traffic_hourly` (
	`bucket_start` integer NOT NULL,
	`host` text NOT NULL,
	`status` integer NOT NULL,
	`requests` integer NOT NULL,
	`bytes_out` integer NOT NULL,
	`duration_ms_sum` real NOT NULL,
	`duration_ms_max` real NOT NULL,
	PRIMARY KEY(`bucket_start`, `host`, `status`)
);
