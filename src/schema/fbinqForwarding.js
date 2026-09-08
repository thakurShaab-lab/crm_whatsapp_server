import { mysqlTable, int, varchar, char, datetime } from 'drizzle-orm/mysql-core'

/**
 * Maps `fbinq_forwarding_tbl` — configures round-robin auto-lead-distribution among
 * an admin's sub-employees per lead source. `shiftStatus` toggles N/Y to track whose
 * turn is next (reset to N for everyone once all have had a turn); `leadShiftStatus`
 * marks whether an employee currently participates in the rotation at all for a
 * given source.
 */
export const fbinqForwarding = mysqlTable('fbinq_forwarding_tbl', {
  slno: int('slno').autoincrement().primaryKey(),
  empId: int('emp_id').notNull(),
  userAdminId: int('user_admin_id').notNull(),
  forSourceId: varchar('for_source_id', { length: 255 }).notNull(),
  empName: varchar('emp_name', { length: 50 }).notNull(),
  empEmail: varchar('emp_email', { length: 80 }).notNull(),
  shiftStatus: char('shift_status', { length: 1 }).notNull().default('N'),
  ptype: char('ptype', { length: 10 }).notNull(),
  status: varchar('status', { length: 1 }).notNull().default('N'),
  createdAt: datetime('created_at').notNull(),
  modifiedDt: datetime('modified_dt').notNull(),
  leadShiftStatus: varchar('lead_shift_status', { length: 2 }).notNull().default('N'), // N=Sent, D=Not Sent
})
