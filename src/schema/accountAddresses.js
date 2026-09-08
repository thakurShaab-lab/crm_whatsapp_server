import { mysqlTable, int, varchar, tinyint } from 'drizzle-orm/mysql-core'

/** Maps `tbl_account_addresses` — a placeholder billing/shipping-address row created alongside every new `tbl_account`. */
export const accountAddresses = mysqlTable('tbl_account_addresses', {
  addressId: int('address_id').autoincrement().primaryKey(),
  accountId: int('account_id').notNull(),
  billingAddress: varchar('billing_address', { length: 250 }).notNull(),
  billingCity: varchar('billing_city', { length: 50 }).notNull(),
  billingPincode: varchar('billing_pincode', { length: 10 }).notNull(),
  billingStreet: varchar('billing_street', { length: 250 }).notNull(),
  billingState: varchar('billing_state', { length: 50 }).notNull(),
  billingCountry: int('billing_country').notNull(),
  shippingAddress: varchar('shipping_address', { length: 250 }).notNull(),
  shippingCity: varchar('shipping_city', { length: 250 }).notNull(),
  shippingPincode: varchar('shipping_pincode', { length: 10 }).notNull(),
  shippingStreet: varchar('shipping_street', { length: 250 }).notNull(),
  shippingState: varchar('shipping_state', { length: 50 }).notNull(),
  shippingCountry: int('shipping_country').notNull(),
  isShift: tinyint('is_shift').notNull().default(0),
  masterId: int('masterID').notNull().default(0),
})
