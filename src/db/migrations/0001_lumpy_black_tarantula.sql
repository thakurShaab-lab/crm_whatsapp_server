CREATE TABLE `whatsapp_sent_response` (
	`sl` int AUTO_INCREMENT NOT NULL,
	`response` text NOT NULL,
	`external_id` varchar(255) NOT NULL,
	`phone_no` varchar(255) NOT NULL,
	`msg_status` char(1) NOT NULL DEFAULT 'N',
	`recvDate` datetime NOT NULL,
	`status` char(1) NOT NULL DEFAULT 'N',
	`status_remark` varchar(500) NOT NULL,
	`status_code` varchar(50),
	`vendor_type` enum('G','C','A') NOT NULL DEFAULT 'G',
	`tempSta` char(1) NOT NULL DEFAULT 'N',
	CONSTRAINT `whatsapp_sent_response_sl` PRIMARY KEY(`sl`)
);
