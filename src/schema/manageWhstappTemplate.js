import { mysqlTable, int, varchar, text, char, mysqlEnum, datetime } from 'drizzle-orm/mysql-core'

/** Maps `manage_whstapp_template` — an approved WhatsApp template's content/config, as registered with the vendor. */
export const manageWhstappTemplate = mysqlTable('manage_whstapp_template', {
  id: int('id').autoincrement().primaryKey(),
  clientId: int('client_id').notNull(),
  templateVendor: char('template_vendor', { length: 1 }).notNull().default('N'), // A=Aisensy, G=Gupshup, C=Netcore
  category: varchar('category', { length: 1 }).notNull().default('N'), // M=Marketing, U=Utility
  templateTitle: varchar('template_title', { length: 255 }).notNull(),
  mainTemplateTitle: varchar('main_template_title', { length: 255 }).notNull(),
  templateDescription: text('template_description').notNull(),
  sampleTemplate: text('sample_template').notNull(),
  templateButtons: text('template_buttons'),
  templateId: varchar('template_id', { length: 255 }).notNull(),
  mediaType: varchar('media_type', { length: 20 }).notNull().default('text'),
  mediaFilename: varchar('media_filename', { length: 255 }).notNull(),
  vendorMediaUrl: varchar('vendor_media_url', { length: 255 }).notNull(),
  templateButtonUrl: varchar('template_button_url', { length: 255 }).notNull(),
  templateLanguage: varchar('template_language', { length: 50 }).notNull().default('en'),
  status: char('status', { length: 1 }).notNull().default('N'), // Y=Approve, D=Not Approve, N=Pending, X=Deactivate, R=Reject
  isAction: mysqlEnum('is_action', ['Y', 'N']).notNull().default('Y'),
  apiApproval: varchar('api_approval', { length: 30 }).notNull().default('Pending'),
  templateVariable: int('template_variable').notNull().default(0),
  sectionType: char('section_type', { length: 1 }).notNull().default('1'), // 1=Customer,2=Lead,3=Deal,4=Vendor,5=Common
  recvDate: datetime('recvDate').notNull(),
  updDate: datetime('updDate').notNull(),
  otherText: text('other_text').notNull(),
  isBtnUrlDynamic: char('is_btn_url_dynamic', { length: 1 }).notNull().default('N'),
  curlResponse: text('curl_response'),
  oldTemplateId: int('old_template_id').notNull(),
  portalSent: char('portal_sent', { length: 1 }).notNull().default('N'),
  portalSentDt: datetime('portal_sent_dt').notNull(),
  invoiceTemplate: char('invoice_template', { length: 1 }).notNull().default('N'),
  invoiceType: varchar('invoice_type', { length: 50 }),
  catgChgOn: datetime('catg_chg_on').notNull(),
})
