CREATE TABLE `tbl_automation_log` (
	`log_id` int AUTO_INCREMENT NOT NULL,
	`source_id` int NOT NULL,
	`stage_id` int NOT NULL,
	`user_admin_id` int NOT NULL,
	`sec_type` tinyint NOT NULL DEFAULT 1,
	`account_id` int NOT NULL,
	`lead_id` int NOT NULL,
	`deal_id` int NOT NULL,
	`mobile` varchar(100) NOT NULL,
	`recv_date` datetime NOT NULL,
	CONSTRAINT `tbl_automation_log_log_id` PRIMARY KEY(`log_id`)
);
--> statement-breakpoint
CREATE TABLE `tbl_deal_info` (
	`deal_info_id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`created_by` int NOT NULL,
	`user_admin_id` int NOT NULL,
	`account_id` int NOT NULL,
	`contact_id` int NOT NULL,
	`prev_deal_owner` int NOT NULL,
	`deal_owner` int NOT NULL,
	`deal_name` varchar(255) NOT NULL,
	`amount` float(10,2) NOT NULL,
	`stage` int NOT NULL,
	`deal_type` enum('1','2') NOT NULL DEFAULT '2',
	`probability` varchar(10) NOT NULL,
	`closing_date` date NOT NULL,
	`expected_revenue` float(10,2) NOT NULL,
	`deal_details` text NOT NULL,
	`description` text NOT NULL,
	`followup_priority` int NOT NULL,
	`deal_last_notes_title` varchar(255),
	`deal_last_notes` text,
	`status` int NOT NULL DEFAULT 1,
	`follow_up_add` char(1) NOT NULL DEFAULT 'N',
	`del_tmp` tinyint NOT NULL DEFAULT 0,
	`shift_support_status` enum('1','2') NOT NULL DEFAULT '2',
	`shift_deal_status` enum('Y','N') NOT NULL DEFAULT 'N',
	`deal_convert_date` datetime,
	`next_followup_date` datetime,
	`next_due_date` date NOT NULL,
	`next_due_date_add_by` enum('N','A','C') NOT NULL DEFAULT 'N',
	`test_update_amount` varchar(100),
	`test_update_stage` varchar(50),
	`wa_template_count` int NOT NULL,
	`wa_template_sent_dt` datetime NOT NULL,
	`sent_wa_template_id` varchar(255) NOT NULL,
	`tempSta` char(1) NOT NULL DEFAULT 'N',
	`auto_template_sent_status` char(1) NOT NULL DEFAULT 'N',
	CONSTRAINT `tbl_deal_info_deal_info_id` PRIMARY KEY(`deal_info_id`)
);
--> statement-breakpoint
CREATE TABLE `tbl_wallet` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_admin_id` int NOT NULL,
	`matter_id` int,
	`matter_type` varchar(60),
	`transaction_amount` float(10,2) NOT NULL DEFAULT 0,
	`wallet_amount` int NOT NULL,
	`currency` char(3) NOT NULL DEFAULT 'INR',
	`transaction_type` enum('Cr','Dr') NOT NULL DEFAULT 'Cr',
	`transaction_id` varchar(50),
	`mode_type` enum('1','2') NOT NULL DEFAULT '1',
	`receive_date` datetime NOT NULL,
	`status` enum('0','1') NOT NULL DEFAULT '1',
	`wallet_type` char(1) NOT NULL DEFAULT 'F',
	`adjustment_rcrd` char(1) NOT NULL DEFAULT 'N',
	CONSTRAINT `tbl_wallet_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_token` (
	`sl` int AUTO_INCREMENT NOT NULL,
	`emp_id` int NOT NULL,
	`token_no` text NOT NULL,
	`recvDate` datetime NOT NULL,
	CONSTRAINT `whatsapp_token_sl` PRIMARY KEY(`sl`)
);
