import { mysqlTable, int, char, float, date } from 'drizzle-orm/mysql-core'

/** Maps `crm_whatsapp_permission` — per-employee WhatsApp wallet/billing state; deduction is only live when `customer_type != 'N'` (the default). */
export const crmWhatsappPermission = mysqlTable('crm_whatsapp_permission', {
  sl: int('sl').autoincrement().primaryKey(),
  clientId: int('client_id').notNull(),
  totalWpSent: int('total_wp_sent').notNull(),
  utlityMsg: int('utlity_msg').notNull(),
  mktgMsg: int('mktg_msg').notNull(),
  whatsappVendor: char('whatsapp_vendor', { length: 1 }).notNull().default('N'),
  walletAmt: float('wallet_amt', { precision: 10, scale: 2 }).notNull(),
  freeBalWalletAmt: float('free_bal_wallet_amt', { precision: 10, scale: 2 }).notNull(),
  balWalletAmt: float('bal_wallet_amt', { precision: 10, scale: 2 }).notNull(),
  balWalletAmtTemp: float('bal_wallet_amt_temp', { precision: 10, scale: 2 }).notNull(),
  activateDate: date('activate_date').notNull(),
  updDate: date('upd_date').notNull(),
  status: char('status', { length: 1 }).notNull().default('N'), // A=Active, D=Deactivate
  customerType: char('customer_type', { length: 1 }).notNull().default('N'), // S=Smo, F=Free, P=Free20, R=Paid, N=Default
  tempSta: char('tempSta', { length: 1 }).notNull().default('N'),
})
