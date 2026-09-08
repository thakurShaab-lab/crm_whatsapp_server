CREATE TABLE `nc_journey_master` (
	`journey_id` int AUTO_INCREMENT NOT NULL,
	`client_id` int NOT NULL DEFAULT 0,
	`journey_title` varchar(255) NOT NULL DEFAULT '',
	`journey_trigger_message` varchar(255) NOT NULL DEFAULT '',
	`journey_trigger_matchtype` int NOT NULL DEFAULT 0,
	`journey_mobile_no` varchar(255) NOT NULL DEFAULT '',
	`journey_refer_id` int NOT NULL DEFAULT 0,
	`journey_status` tinyint NOT NULL DEFAULT 0,
	`journey_datetime` datetime NOT NULL,
	`journey_added_by` int NOT NULL DEFAULT 0,
	CONSTRAINT `nc_journey_master_journey_id` PRIMARY KEY(`journey_id`)
);
--> statement-breakpoint
CREATE TABLE `nc_journey_nodes` (
	`node_slno` int AUTO_INCREMENT NOT NULL,
	`journey_id` int DEFAULT 0,
	`client_id` int NOT NULL DEFAULT 0,
	`node_element_type` varchar(255) NOT NULL DEFAULT '',
	`node_parent_id` int NOT NULL DEFAULT 0,
	`node_level_parent_id` int NOT NULL DEFAULT 0,
	`node_message_json` text NOT NULL,
	`node_datetime` datetime NOT NULL,
	CONSTRAINT `nc_journey_nodes_node_slno` PRIMARY KEY(`node_slno`)
);
--> statement-breakpoint
CREATE TABLE `nc_journey_track_log` (
	`log_id` int AUTO_INCREMENT NOT NULL,
	`log_track_id` int NOT NULL DEFAULT 0,
	`log_node_id` int NOT NULL DEFAULT 0,
	`log_datetime` datetime NOT NULL,
	CONSTRAINT `nc_journey_track_log_log_id` PRIMARY KEY(`log_id`)
);
--> statement-breakpoint
CREATE TABLE `nc_journey_tracker` (
	`track_id` int AUTO_INCREMENT NOT NULL,
	`client_id` int NOT NULL DEFAULT 0,
	`track_mobile_no` varchar(255) NOT NULL DEFAULT '',
	`track_journey_id` int NOT NULL DEFAULT 0,
	`track_from_mobile_no` varchar(255) NOT NULL DEFAULT '',
	`track_log_status` tinyint NOT NULL DEFAULT 0,
	`track_log_datetime` datetime NOT NULL,
	`track_log_timeout` int NOT NULL DEFAULT 86400,
	CONSTRAINT `nc_journey_tracker_track_id` PRIMARY KEY(`track_id`)
);
