import { mysqlTable, int, varchar, char, float, datetime, mysqlEnum } from 'drizzle-orm/mysql-core'

/**
 * Maps `tbl_wallet` exactly as it exists in the live database (SQL dump in
 * whatsapp_inbox_db_tables/tbl_wallet.sql) — the recharge/transaction ledger. Only
 * ever read here (never written), to detect whether a tenant has ever made a genuine
 * paid recharge (`wallet_type='R'`, positive amount), which upgrades their billing
 * tier — see helper.php's `send_automation_whatsapp_template()` (~line 815).
 */
export const wallet = mysqlTable('tbl_wallet', {
  id: int('id').autoincrement().primaryKey(),
  userAdminId: int('user_admin_id').notNull(),
  matterId: int('matter_id'),
  matterType: varchar('matter_type', { length: 60 }),
  transactionAmount: float('transaction_amount', { precision: 10, scale: 2 }).notNull().default(0),
  walletAmount: int('wallet_amount').notNull(),
  currency: char('currency', { length: 3 }).notNull().default('INR'),
  transactionType: mysqlEnum('transaction_type', ['Cr', 'Dr']).notNull().default('Cr'),
  transactionId: varchar('transaction_id', { length: 50 }),
  modeType: mysqlEnum('mode_type', ['1', '2']).notNull().default('1'), // 1=Online, 2=Offline
  receiveDate: datetime('receive_date').notNull(),
  status: mysqlEnum('status', ['0', '1']).notNull().default('1'),
  walletType: char('wallet_type', { length: 1 }).notNull().default('F'), // F=Free, R=Recharge
  adjustmentRcrd: char('adjustment_rcrd', { length: 1 }).notNull().default('N'),
})
