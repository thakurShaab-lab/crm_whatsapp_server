import { mysqlTable, int, varchar, text, char, mysqlEnum, date, datetime, tinyint, float } from 'drizzle-orm/mysql-core'

/**
 * Maps `tbl_deal_info` exactly as it exists in the live database (SQL dump in
 * whatsapp_inbox_db_tables/tbl_deal_info.sql) — the CRM's deal/opportunity record.
 * Only used here for `{{deal.*}}` template-variable resolution and the per-deal
 * WA-template-sent bookkeeping (templateAutomation.js), matching helper.php's
 * `send_automation_whatsapp_template()`.
 */
export const dealInfo = mysqlTable('tbl_deal_info', {
  dealInfoId: int('deal_info_id').autoincrement().primaryKey(),
  leadId: int('lead_id').notNull(),
  createdBy: int('created_by').notNull(),
  userAdminId: int('user_admin_id').notNull(),
  accountId: int('account_id').notNull(),
  contactId: int('contact_id').notNull(),
  prevDealOwner: int('prev_deal_owner').notNull(),
  dealOwner: int('deal_owner').notNull(),
  dealName: varchar('deal_name', { length: 255 }).notNull(),
  amount: float('amount', { precision: 10, scale: 2 }).notNull(),
  stage: int('stage').notNull(),
  dealType: mysqlEnum('deal_type', ['1', '2']).notNull().default('2'), // 1=Existing, 2=New Business
  probability: varchar('probability', { length: 10 }).notNull(),
  closingDate: date('closing_date').notNull(),
  expectedRevenue: float('expected_revenue', { precision: 10, scale: 2 }).notNull(),
  dealDetails: text('deal_details').notNull(),
  description: text('description').notNull(),
  followupPriority: int('followup_priority').notNull(),
  dealLastNotesTitle: varchar('deal_last_notes_title', { length: 255 }),
  dealLastNotes: text('deal_last_notes'),
  status: int('status').notNull().default(1),
  followUpAdd: char('follow_up_add', { length: 1 }).notNull().default('N'),
  delTmp: tinyint('del_tmp').notNull().default(0), // 0=Not Delete, 1=Delete
  shiftSupportStatus: mysqlEnum('shift_support_status', ['1', '2']).notNull().default('2'), // 1=yes, 2=no
  shiftDealStatus: mysqlEnum('shift_deal_status', ['Y', 'N']).notNull().default('N'),
  dealConvertDate: datetime('deal_convert_date'),
  nextFollowupDate: datetime('next_followup_date'),
  nextDueDate: date('next_due_date').notNull(),
  nextDueDateAddBy: mysqlEnum('next_due_date_add_by', ['N', 'A', 'C']).notNull().default('N'),
  testUpdateAmount: varchar('test_update_amount', { length: 100 }),
  testUpdateStage: varchar('test_update_stage', { length: 50 }),
  waTemplateCount: int('wa_template_count').notNull(),
  waTemplateSentDt: datetime('wa_template_sent_dt').notNull(),
  sentWaTemplateId: varchar('sent_wa_template_id', { length: 255 }).notNull(),
  tempSta: char('tempSta', { length: 1 }).notNull().default('N'),
  autoTemplateSentStatus: char('auto_template_sent_status', { length: 1 }).notNull().default('N'), // N=Default, Y=Sent
})
