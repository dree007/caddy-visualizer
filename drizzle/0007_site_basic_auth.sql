PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_caddy_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`hostname` text NOT NULL,
	`upstream` text NOT NULL,
	`tls` text NOT NULL,
	`enabled` integer NOT NULL,
	`basic_auth_username` text,
	`basic_auth_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "caddy_sites_tls_check" CHECK("__new_caddy_sites"."tls" in ('automatic', 'off')),
	CONSTRAINT "caddy_sites_enabled_check" CHECK("__new_caddy_sites"."enabled" in (0, 1)),
	CONSTRAINT "caddy_sites_basic_auth_check" CHECK(("__new_caddy_sites"."basic_auth_username" is null) = ("__new_caddy_sites"."basic_auth_hash" is null) and ("__new_caddy_sites"."basic_auth_hash" is null or "__new_caddy_sites"."tls" = 'automatic'))
);
--> statement-breakpoint
INSERT INTO `__new_caddy_sites`("id", "hostname", "upstream", "tls", "enabled", "basic_auth_username", "basic_auth_hash", "created_at", "updated_at") SELECT "id", "hostname", "upstream", "tls", "enabled", NULL, NULL, "created_at", "updated_at" FROM `caddy_sites`;--> statement-breakpoint
DROP TABLE `caddy_sites`;--> statement-breakpoint
ALTER TABLE `__new_caddy_sites` RENAME TO `caddy_sites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `caddy_sites_hostname_unique` ON `caddy_sites` (`hostname`);