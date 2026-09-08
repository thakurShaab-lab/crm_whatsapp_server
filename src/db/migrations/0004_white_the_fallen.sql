CREATE TABLE `tbl_automation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`added_by` int NOT NULL,
	`user_admin_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`section_type` tinyint NOT NULL DEFAULT 1,
	`source_ids` varchar(255) NOT NULL,
	`stage_ids` varchar(255) NOT NULL,
	`run_condition` tinyint NOT NULL DEFAULT 1,
	`template_id` int NOT NULL,
	`status` tinyint NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	`updated_at` datetime,
	CONSTRAINT `tbl_automation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_whatsapp_permission` (
	`sl` int AUTO_INCREMENT NOT NULL,
	`client_id` int NOT NULL,
	`total_wp_sent` int NOT NULL,
	`utlity_msg` int NOT NULL,
	`mktg_msg` int NOT NULL,
	`whatsapp_vendor` char(1) NOT NULL DEFAULT 'N',
	`wallet_amt` float(10,2) NOT NULL,
	`free_bal_wallet_amt` float(10,2) NOT NULL,
	`bal_wallet_amt` float(10,2) NOT NULL,
	`bal_wallet_amt_temp` float(10,2) NOT NULL,
	`activate_date` date NOT NULL,
	`upd_date` date NOT NULL,
	`status` char(1) NOT NULL DEFAULT 'N',
	`customer_type` char(1) NOT NULL DEFAULT 'N',
	`tempSta` char(1) NOT NULL DEFAULT 'N',
	CONSTRAINT `crm_whatsapp_permission_sl` PRIMARY KEY(`sl`)
);
--> statement-breakpoint
CREATE TABLE `manage_whstapp_template` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` int NOT NULL,
	`template_vendor` char(1) NOT NULL DEFAULT 'N',
	`category` varchar(1) NOT NULL DEFAULT 'N',
	`template_title` varchar(255) NOT NULL,
	`main_template_title` varchar(255) NOT NULL,
	`template_description` text NOT NULL,
	`sample_template` text NOT NULL,
	`template_buttons` text,
	`template_id` varchar(255) NOT NULL,
	`media_type` varchar(20) NOT NULL DEFAULT 'text',
	`media_filename` varchar(255) NOT NULL,
	`vendor_media_url` varchar(255) NOT NULL,
	`template_button_url` varchar(255) NOT NULL,
	`template_language` varchar(50) NOT NULL DEFAULT 'en',
	`status` char(1) NOT NULL DEFAULT 'N',
	`is_action` enum('Y','N') NOT NULL DEFAULT 'Y',
	`api_approval` varchar(30) NOT NULL DEFAULT 'Pending',
	`template_variable` int NOT NULL DEFAULT 0,
	`section_type` char(1) NOT NULL DEFAULT '1',
	`recvDate` datetime NOT NULL,
	`updDate` datetime NOT NULL,
	`other_text` text NOT NULL,
	`is_btn_url_dynamic` char(1) NOT NULL DEFAULT 'N',
	`curl_response` text,
	`old_template_id` int NOT NULL,
	`portal_sent` char(1) NOT NULL DEFAULT 'N',
	`portal_sent_dt` datetime NOT NULL,
	`invoice_template` char(1) NOT NULL DEFAULT 'N',
	`invoice_type` varchar(50),
	`catg_chg_on` datetime NOT NULL,
	CONSTRAINT `manage_whstapp_template_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_variable_name` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tid` int NOT NULL,
	`vid` int NOT NULL,
	`variable_name` varchar(255) NOT NULL,
	`sec_type_field_name` varchar(100),
	`recvDate` datetime NOT NULL,
	CONSTRAINT `template_variable_name_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_country_wise_charge` (
	`sl` int AUTO_INCREMENT NOT NULL,
	`country` varchar(255) NOT NULL,
	`country_code` int NOT NULL,
	`wa_mktg_amt` float(10,4) NOT NULL,
	`wa_utility_amt` float(10,4) NOT NULL,
	`auth_amt` float(10,4) NOT NULL,
	`auth_int_amt` float(10,4) NOT NULL,
	`for_emp` int NOT NULL,
	CONSTRAINT `whatsapp_country_wise_charge_sl` PRIMARY KEY(`sl`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_sent_from_client` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_admin_id` int NOT NULL,
	`account_id` int NOT NULL,
	`lead_id` int NOT NULL,
	`template_catg` char(1) NOT NULL DEFAULT 'N',
	`template_vendor` char(1) NOT NULL DEFAULT 'N',
	`msg_id` varchar(255) NOT NULL,
	`send_to` varchar(255) NOT NULL,
	`tid` varchar(255) NOT NULL,
	`old_tid` int NOT NULL,
	`sent_on` datetime NOT NULL,
	`status` char(1) NOT NULL DEFAULT 'Y',
	`tempsta` char(1) NOT NULL DEFAULT 'N',
	`status_new` char(1) NOT NULL DEFAULT 'S',
	`mm_lite` char(1) NOT NULL DEFAULT 'Y',
	CONSTRAINT `whatsapp_sent_from_client_id` PRIMARY KEY(`id`)
);
