import { mysqlTable, int, varchar, text, char, mysqlEnum, date, datetime } from 'drizzle-orm/mysql-core'

/** Maps `tbl_activity` — a "Fresh Party" follow-up task gets created alongside every new lead, matching the legacy insert. */
export const activity = mysqlTable('tbl_activity', {
  activityId: int('activity_id').autoincrement().primaryKey(),
  createdBy: int('created_by').notNull(),
  userAdminId: int('user_admin_id').notNull().default(0),
  oldUserAdminId: int('old_user_admin_id'),
  activityType: mysqlEnum('activity_type', ['1', '2', '3', '4']).notNull(), // 1=task, 2=event, 3=call, 4=reminder
  subject: varchar('subject', { length: 255 }).notNull(),
  dueDate: datetime('due_date').notNull(),
  priority: int('priority').notNull(),
  owner: int('owner').notNull(),
  contactName: mysqlEnum('contact_name', ['1', '2']).notNull(), // 1=Contact, 2=Lead
  leadOrContactId: int('lead_or_contact_id'),
  realtedTo: mysqlEnum('realted_to', ['1', '2']).notNull(), // 1=Account, 2=Deal
  accountOrDealId: int('account_or_deal_id'),
  taskStatus: int('task_status').notNull(),
  description: text('description').notNull(),
  startDueDate: date('start_due_date').notNull(),
  startDueTime: varchar('start_due_time', { length: 20 }).notNull(),
  endDueDate: date('end_due_date').notNull(),
  endDueTime: varchar('end_due_time', { length: 20 }).notNull(),
  location: varchar('location', { length: 100 }).notNull(),
  country: int('country').notNull(),
  participants: int('participants').notNull(),
  callPurpose: int('call_purpose').notNull(),
  callType: int('call_type').notNull(),
  callDetail: int('call_detail').notNull(),
  callResult: int('call_result').notNull(),
  activeStatus: mysqlEnum('active_status', ['1', '2']).notNull().default('1'), // 1=Open, 2=Closed
  unattendent: int('unattendent').notNull().default(0),
  isCheckedAttendent: int('is_checked_attendent').notNull().default(0),
  postedDealOrLead: int('posted_deal_or_lead').notNull(), // 1=deal, 3=lead, 4=reminder
  createdAt: datetime('created_at').notNull(),
  modifiedAt: datetime('modified_at').notNull(),
  status: mysqlEnum('status', ['0', '1', '2', '3']).notNull().default('1'),
  tempSta: mysqlEnum('tempSta', ['Y', 'N']).notNull().default('N'),
  followupAddBy: mysqlEnum('followup_add_by', ['N', 'A', 'C']).notNull().default('N'), // N=Default, A=Auto, C=Client
  agentId: int('agent_id').notNull().default(0),
  isDelete: int('is_delete').notNull().default(1), // 1=normal, 2=deleted
  isSprtFollowup: mysqlEnum('is_sprt_followup', ['A', 'S']).notNull().default('A'),
})
