import { mysqlTable, int, varchar, float } from 'drizzle-orm/mysql-core'

/** Maps `whatsapp_country_wise_charge` — per-country, per-employee-tier marketing/utility template cost. */
export const whatsappCountryWiseCharge = mysqlTable('whatsapp_country_wise_charge', {
  sl: int('sl').autoincrement().primaryKey(),
  country: varchar('country', { length: 255 }).notNull(),
  countryCode: int('country_code').notNull(),
  waMktgAmt: float('wa_mktg_amt', { precision: 10, scale: 4 }).notNull(),
  waUtilityAmt: float('wa_utility_amt', { precision: 10, scale: 4 }).notNull(),
  authAmt: float('auth_amt', { precision: 10, scale: 4 }).notNull(),
  authIntAmt: float('auth_int_amt', { precision: 10, scale: 4 }).notNull(),
  forEmp: int('for_emp').notNull(), // 1=india_to_india, 2=int_cost_in_inr, 3=int_cost_in_usd
})
