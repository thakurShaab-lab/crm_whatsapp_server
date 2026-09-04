import { mysqlTable, int, varchar, text, datetime } from 'drizzle-orm/mysql-core'

/**
 * Maps `whatsapp_incoming_reply_response_log` exactly as it exists in the live
 * database — an audit trail of every vendor API call (request/response), keyed
 * loosely by `template_id` and tagged with where the call originated (`api_url_use`).
 */
export const incomingReplyResponseLog = mysqlTable('whatsapp_incoming_reply_response_log', {
  id: int('id').autoincrement().primaryKey(),
  userAdminId: int('user_admin_id').notNull(),
  templateId: int('template_id').notNull().default(0),
  apiUrl: text('api_url'),
  apiUrlUse: varchar('api_url_use', { length: 100 }),
  jsonData: text('json_data'),
  jsonResponse: text('json_response'),
  receiveDate: datetime('receive_date'),
})
