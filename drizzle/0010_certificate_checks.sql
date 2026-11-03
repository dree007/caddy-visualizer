CREATE TABLE `certificate_checks` (
	`hostname` text PRIMARY KEY NOT NULL,
	`outcome` text NOT NULL,
	`error` text,
	`address` text,
	`subject` text,
	`issuer` text,
	`valid_from` integer,
	`valid_to` integer,
	`sans` text,
	`fingerprint256` text,
	`checked_at` integer NOT NULL,
	`last_success_at` integer
);
