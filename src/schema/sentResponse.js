import { mysqlTable, int, varchar, text, char, datetime, mysqlEnum } from 'drizzle-orm/mysql-core'

/**
 * Maps `whatsapp_sent_response` exactly as it exists in the live database — the
 * legacy vendor delivery-status feed, keyed by `external_id` (the vendor message id,
 * i.e. `messages.sourceId`). This is the real source of an outbound message's tick
 * icon, exactly as `whatsapp_chatt_message_container.php` reads it.
 */
export const sentResponse = mysqlTable('whatsapp_sent_response', {
  sl: int('sl').autoincrement().primaryKey(),
  response: text('response').notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  phoneNo: varchar('phone_no', { length: 255 }).notNull(),
  msgStatus: char('msg_status', { length: 1 }).notNull().default('N'), // S:Sent, D:Delivered, R:Read, F:Failed
  recvDate: datetime('recvDate').notNull(),
  status: char('status', { length: 1 }).notNull().default('N'),
  statusRemark: varchar('status_remark', { length: 500 }).notNull(),
  statusCode: varchar('status_code', { length: 50 }),
  vendorType: mysqlEnum('vendor_type', ['G', 'C', 'A']).notNull().default('G'),
  tempSta: char('tempSta', { length: 1 }).notNull().default('N'),
})
