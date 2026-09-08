import { mysqlTable, int, varchar, text, tinyint, datetime } from 'drizzle-orm/mysql-core'

/** Maps `tbl_automation` — a rule mapping (section_type, source_ids, stage_ids) to a template_id, matched via FIND_IN_SET against the comma-separated id lists. */
export const automation = mysqlTable('tbl_automation', {
  id: int('id').autoincrement().primaryKey(),
  addedBy: int('added_by').notNull(),
  userAdminId: int('user_admin_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  sectionType: tinyint('section_type').notNull().default(1), // 1=Customer, 2=Lead, 3=Deal
  sourceIds: varchar('source_ids', { length: 255 }).notNull(),
  stageIds: varchar('stage_ids', { length: 255 }).notNull(),
  runCondition: tinyint('run_condition').notNull().default(1), // 1=immediate
  templateId: int('template_id').notNull(),
  status: tinyint('status').notNull().default(0), // 1=Active, 0=Deactive, 2=Delete
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at'),
})
