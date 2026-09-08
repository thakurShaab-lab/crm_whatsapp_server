import { mysqlTable, int, varchar, mysqlEnum } from 'drizzle-orm/mysql-core'

/** Maps `tbl_lead_source` — find-or-create "Whatsapp" row per employee is how inbound messages get tagged with a lead source. */
export const leadSource = mysqlTable('tbl_lead_source', {
  sid: int('sid').autoincrement().primaryKey(),
  createdBy: int('created_by').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  fbHeadingName: varchar('fb_heading_name', { length: 255 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: mysqlEnum('status', ['0', '1', '2']).notNull().default('1'),
  isDefault: int('is_default').notNull().default(0),
  apiType: varchar('api_type', { length: 255 }).notNull(),
  oldSourceId: int('old_source_id').notNull().default(0),
})
