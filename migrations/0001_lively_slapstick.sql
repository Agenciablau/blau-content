CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`actor` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`decision` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `archived` integer DEFAULT 0 NOT NULL;