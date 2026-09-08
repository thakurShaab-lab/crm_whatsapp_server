import { mysqlTable, int, varchar, text, char, date, time, datetime, tinyint } from 'drizzle-orm/mysql-core'

/**
 * Maps `tbl_contacts` — the CRM's general contact-person table (distinct from a
 * WhatsApp "contact"/conversation in the rest of this codebase, hence the `crm`
 * prefix). Only used here to auto-create a contact-person row for a brand-new
 * WhatsApp account, matching the legacy `lead_insert_data_aisensy()`.
 */
export const crmContacts = mysqlTable('tbl_contacts', {
  contactId: int('contact_id').autoincrement().primaryKey(),
  createdBy: int('created_by'),
  userAdminId: int('user_admin_id').notNull(),
  oldUserAdminId: int('old_user_admin_id'),
  contactPic: varchar('contact_pic', { length: 100 }),
  contactOwner: int('contact_owner'),
  leadSource: int('lead_source'),
  title: varchar('title', { length: 10 }),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  accountName: int('account_name'), // actually an account_id FK, named account_name in the live schema
  email: varchar('email', { length: 100 }),
  department: int('department'),
  phone: varchar('phone', { length: 18 }),
  homePhone: varchar('home_phone', { length: 18 }),
  otherPhone: varchar('ohter_phone', { length: 18 }),
  fax: varchar('fax', { length: 18 }),
  mobile: varchar('mobile', { length: 14 }),
  dob: date('dob'),
  assistant: varchar('assistant', { length: 50 }),
  asstPhone: varchar('asst_phone', { length: 18 }),
  otherMobileNo: varchar('ohter_mobile_no', { length: 18 }),
  skypeId: varchar('skype_id', { length: 100 }),
  secondaryEmail: varchar('secondary_email', { length: 150 }),
  twitter: varchar('twitter', { length: 150 }),
  reportingTo: int('reporting_to'),
  mailingAddress: text('mailing_address'),
  mailingStreet: text('mailing_street'),
  mailingCity: varchar('mailing_city', { length: 80 }),
  mailingState: varchar('mailing_state', { length: 80 }),
  mailingPostcode: varchar('mailing_postcode', { length: 10 }),
  mailingCountry: int('mailing_country'),
  description: text('description'),
  createdAt: datetime('created_at').notNull(),
  modifyAt: datetime('modify_at').notNull(),
  status: int('status').notNull().default(1), // 0=inactive, 1=active, 2=delete
  isShift: tinyint('is_shift').notNull().default(0),
  masterId: int('masterID').default(0),
  vendorId: int('vendor_id').notNull().default(0),
  mailStatus: char('mail_status', { length: 1 }).notNull().default('N'),
  mailDate: date('mail_date').notNull(),
  mailTime: time('mail_time').notNull(),
})
