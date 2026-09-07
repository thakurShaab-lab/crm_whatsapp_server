CREATE TABLE `whatsapp_chat_deletions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_admin_id` int NOT NULL,
	`wa_number` varchar(255) NOT NULL,
	`mobile` varchar(255) NOT NULL,
	`deleted_at` datetime NOT NULL,
	CONSTRAINT `whatsapp_chat_deletions_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_deletions_scope_idx` UNIQUE(`user_admin_id`,`wa_number`,`mobile`)
);
