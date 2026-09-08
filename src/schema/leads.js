import { mysqlTable, int, bigint, varchar, text, char, mysqlEnum, date, datetime, tinyint } from 'drizzle-orm/mysql-core'

/**
 * Maps `tbl_leads` exactly as it exists in the live database (introspected from the
 * SQL dump in whatsapp_inbox_db_tables/tbl_leads.sql) — the CRM's lead/deal pipeline
 * table. Only used here to auto-create a lead for a brand-new WhatsApp contact
 * (leadAutoCreation.js), matching `lead_insert_data_aisensy()` in the legacy PHP.
 * Most of this table's ~60 columns are full CRM lead-management fields unrelated to
 * WhatsApp — modeled for completeness/type-safety, but only a handful are ever
 * written here; the rest are left to MySQL's own column defaults on insert, exactly
 * as the legacy `insert_data()` helper (a partial INSERT) already relied on.
 */
export const leads = mysqlTable('tbl_leads', {
  leadId: int('lead_id').autoincrement().primaryKey(),
  addedBy: int('added_by').notNull(),
  userAdminId: int('user_admin_id').notNull(),
  accountId: int('account_id'),
  memberType: int('member_type').notNull().default(0),
  accountIdMd5: varchar('account_id_md5', { length: 35 }).notNull(),
  contactId: int('contact_id').notNull(),
  leadStatus: varchar('lead_status', { length: 11 }).notNull(),
  leadTitle: varchar('lead_title', { length: 255 }),
  website: varchar('website', { length: 255 }).notNull(),
  nameTitle: varchar('name_title', { length: 5 }).notNull(),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 50 }).notNull(),
  company: varchar('company', { length: 50 }).notNull(),
  companyId: int('company_id'),
  email: varchar('email', { length: 100 }).notNull(),
  industry: int('industry').notNull(),
  fax: varchar('fax', { length: 15 }).notNull(),
  phone: varchar('phone', { length: 100 }).notNull(),
  mobile: varchar('mobile', { length: 100 }).notNull(),
  alternateMobile: varchar('alternate_mobile', { length: 20 }),
  noOfEmployee: int('no_of_employee').notNull(),
  leadSource: varchar('lead_source', { length: 50 }).notNull(),
  oldLeadSource: varchar('old_lead_source', { length: 50 }),
  leadOwner: int('lead_owner').notNull(),
  rating: varchar('rating', { length: 10 }).notNull(),
  address: text('address').notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  city: varchar('city', { length: 50 }).notNull(),
  state: varchar('state', { length: 50 }).notNull(),
  postCode: varchar('post_code', { length: 10 }).notNull(),
  country: int('country').notNull(),
  ctryIsdCode: varchar('ctry_isd_code', { length: 10 }).notNull().default('91'),
  description: text('description').notNull(),
  followupPriority: int('followup_priority').notNull(),
  leadLastNotesTitle: varchar('lead_last_notes_title', { length: 255 }),
  leadLastNotes: text('lead_last_notes'),
  isDeal: mysqlEnum('is_deal', ['1', '2']).notNull().default('2'), // 1=Yes, 2=Lead
  unattendent: int('unattendent').notNull(),
  isCheckedAttendent: int('is_checked_attendent').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
  shiftedDate: datetime('shifted_date'),
  status: mysqlEnum('status', ['0', '1', '2']).notNull().default('1'), // 0=inactive, 1=active, 2=delete
  isShift: tinyint('is_shift').notNull().default(0),
  masterId: int('masterID').default(0),
  dueDate: datetime('due_date'),
  nextDueDate: date('next_due_date').notNull(),
  nextDueDateAddBy: mysqlEnum('next_due_date_add_by', ['N', 'A', 'C']).notNull().default('N'),
  department: int('department'),
  leadSourcType: char('lead_sourc_type', { length: 4 }).notNull(),
  leadSourceId: bigint('lead_source_id', { mode: 'number' }).notNull(),
  isApi: tinyint('is_api').default(0),
  contactStatus: char('contact_status', { length: 1 }).notNull().default('N'),
  followUpAdd: char('follow_up_add', { length: 1 }).notNull().default('N'),
  leadTouchStatus: char('lead_touch_status', { length: 1 }).notNull().default('N'),
  fbPageName: varchar('fb_page_name', { length: 255 }),
  webhookInsertId: int('webhook_insert_id').notNull().default(0),
  alternateMblUpdDt: datetime('alternate_mbl_upd_dt').notNull(),
  getLeadFromFb: mysqlEnum('get_lead_from_fb', ['N', 'C']).default('N'),
  chatQuestionAnswer: text('chat_question_answer'),
  freshPtyStatus: char('fresh_pty_status', { length: 1 }).notNull().default('Y'),
  sentWaTemplateId: varchar('sent_wa_template_id', { length: 255 }).notNull(),
  waTemplateCount: int('wa_template_count').notNull(),
  waTemplateSentDt: datetime('wa_template_sent_dt').notNull(),
  tempSta: char('tempSta', { length: 1 }).notNull().default('N'),
  isXls: mysqlEnum('is_xls', ['Y', 'N']).notNull().default('N'),
  autoTemplateSentDate: date('auto_template_sent_date').notNull(),
  autoTemplateSentStatus: char('auto_template_sent_status', { length: 1 }).notNull().default('N'),
})
