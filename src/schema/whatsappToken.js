import { mysqlTable, int, text, datetime } from 'drizzle-orm/mysql-core'

/**
 * Maps `whatsapp_token` exactly as it exists in the live database (SQL dump in
 * whatsapp_inbox_db_tables/whatsapp_token.sql) — an audit log of every AiSensy WABA
 * token regeneration, written alongside `tbl_employees`'s own token columns by
 * legacy's `update_whatsapp_token()` (helper.php). See vendors/aisensyToken.js.
 */
export const whatsappToken = mysqlTable('whatsapp_token', {
  sl: int('sl').autoincrement().primaryKey(),
  empId: int('emp_id').notNull(),
  tokenNo: text('token_no').notNull(),
  recvDate: datetime('recvDate').notNull(),
})
