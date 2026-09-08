import { mysqlTable, int, varchar, char, datetime } from 'drizzle-orm/mysql-core'

/** Maps `whatsapp_sent_from_client` — an audit row per template send, separate from the message log itself. */
export const whatsappSentFromClient = mysqlTable('whatsapp_sent_from_client', {
  id: int('id').autoincrement().primaryKey(),
  userAdminId: int('user_admin_id').notNull(),
  accountId: int('account_id').notNull(),
  leadId: int('lead_id').notNull(),
  templateCatg: char('template_catg', { length: 1 }).notNull().default('N'), // M=Marketing, U=Utility
  templateVendor: char('template_vendor', { length: 1 }).notNull().default('N'),
  msgId: varchar('msg_id', { length: 255 }).notNull(),
  sendTo: varchar('send_to', { length: 255 }).notNull(),
  tid: varchar('tid', { length: 255 }).notNull(),
  oldTid: int('old_tid').notNull(),
  sentOn: datetime('sent_on').notNull(),
  status: char('status', { length: 1 }).notNull().default('Y'),
  tempsta: char('tempsta', { length: 1 }).notNull().default('N'),
  statusNew: char('status_new', { length: 1 }).notNull().default('S'), // S=Sent, Y=Delivered/Read, D=Failed
  mmLite: char('mm_lite', { length: 1 }).notNull().default('Y'),
})
