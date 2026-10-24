PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_caddy_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`hostname` text NOT NULL,
	`kind` text DEFAULT 'proxy' NOT NULL,
	`upstream` text,
	`upstream_skip_tls_verify` integer DEFAULT false NOT NULL,
	`redirect_target` text,
	`redirect_code` integer,
	`tls` text NOT NULL,
	`enabled` integer NOT NULL,
	`basic_auth_username` text,
	`basic_auth_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "caddy_sites_tls_check" CHECK("__new_caddy_sites"."tls" in ('automatic', 'off')),
	CONSTRAINT "caddy_sites_enabled_check" CHECK("__new_caddy_sites"."enabled" in (0, 1)),
	CONSTRAINT "caddy_sites_kind_check" CHECK(("__new_caddy_sites"."kind" = 'proxy' and "__new_caddy_sites"."upstream" is not null and "__new_caddy_sites"."redirect_target" is null and "__new_caddy_sites"."redirect_code" is null) or ("__new_caddy_sites"."kind" = 'redirect' and "__new_caddy_sites"."upstream" is null and "__new_caddy_sites"."redirect_target" is not null and "__new_caddy_sites"."redirect_code" in (301, 302, 307, 308) and "__new_caddy_sites"."basic_auth_hash" is null)),
	CONSTRAINT "caddy_sites_upstream_skip_tls_verify_check" CHECK("__new_caddy_sites"."upstream_skip_tls_verify" = 0 or ("__new_caddy_sites"."kind" = 'proxy' and "__new_caddy_sites"."upstream" like 'https://%')),
	CONSTRAINT "caddy_sites_basic_auth_check" CHECK(("__new_caddy_sites"."basic_auth_username" is null) = ("__new_caddy_sites"."basic_auth_hash" is null) and ("__new_caddy_sites"."basic_auth_hash" is null or "__new_caddy_sites"."tls" = 'automatic'))
);
--> statement-breakpoint
INSERT INTO `__new_caddy_sites`("id", "hostname", "kind", "upstream", "upstream_skip_tls_verify", "redirect_target", "redirect_code", "tls", "enabled", "basic_auth_username", "basic_auth_hash", "created_at", "updated_at") SELECT "id", "hostname", "kind", "upstream", 0, "redirect_target", "redirect_code", "tls", "enabled", "basic_auth_username", "basic_auth_hash", "created_at", "updated_at" FROM `caddy_sites`;--> statement-breakpoint
DROP TABLE `caddy_sites`;--> statement-breakpoint
ALTER TABLE `__new_caddy_sites` RENAME TO `caddy_sites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `caddy_sites_hostname_unique` ON `caddy_sites` (`hostname`);