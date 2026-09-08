import { mysqlTable, int, varchar, char, mysqlEnum, datetime } from 'drizzle-orm/mysql-core'

/** Maps `tbl_stages` — the lead/deal pipeline stage list; a new lead needs its initial `old_stage_id=1` (section_type='L') stage's real `id`. */
export const stages = mysqlTable('tbl_stages', {
  id: int('id').autoincrement().primaryKey(),
  oldStageId: int('old_stage_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  userAdminId: int('user_admin_id').notNull(),
  status: int('status').notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  isDefault: int('is_default').notNull(),
  stageType: char('stage_type', { length: 1 }).notNull().default('N'), // N=Normal, W=Won, L=Lost
  sectionType: mysqlEnum('section_type', ['L', 'D']).notNull().default('D'), // L=Lead, D=Deal
  createdOn: datetime('created_on').notNull(),
})
