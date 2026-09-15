import { mysqlTable, int, varchar, datetime, tinyint } from 'drizzle-orm/mysql-core'

/**
 * Maps `tbl_automation_log` exactly as it exists in the live database (SQL dump in
 * whatsapp_inbox_db_tables/tbl_automation_log.sql) — an audit trail of automated
 * template sends. Written only by the "Replica Copy For Opposite Waba No" mirror
 * flow inside `send_automation_whatsapp_template()` (helper.php ~lines 975-986):
 * when an auto-triggered template send lands on another tenant's own WABA number,
 * this records that the automation fired, from the receiving tenant's perspective.
 */
export const automationLog = mysqlTable('tbl_automation_log', {
  logId: int('log_id').autoincrement().primaryKey(),
  sourceId: int('source_id').notNull(),
  stageId: int('stage_id').notNull(),
  userAdminId: int('user_admin_id').notNull(),
  secType: tinyint('sec_type').notNull().default(1), // 1=Customer, 2=Lead, 3=Deal
  accountId: int('account_id').notNull(),
  leadId: int('lead_id').notNull(),
  dealId: int('deal_id').notNull(),
  mobile: varchar('mobile', { length: 100 }).notNull(),
  recvDate: datetime('recv_date').notNull(),
})
