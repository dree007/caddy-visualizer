CREATE TABLE `caddy_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`hostname` text NOT NULL,
	`upstream` text NOT NULL,
	`tls` text NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "caddy_sites_tls_check" CHECK("caddy_sites"."tls" in ('automatic', 'off')),
	CONSTRAINT "caddy_sites_enabled_check" CHECK("caddy_sites"."enabled" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `caddy_sites_hostname_unique` ON `caddy_sites` (`hostname`);