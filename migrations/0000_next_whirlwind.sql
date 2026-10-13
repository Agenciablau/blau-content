CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`client_id` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`copy` text DEFAULT '' NOT NULL,
	`channel` text NOT NULL,
	`format` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`asset` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`email` text NOT NULL
);
