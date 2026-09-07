import { mysqlTable, int, varchar, datetime, uniqueIndex } from 'drizzle-orm/mysql-core'

/**
 * "Delete chat" has no legacy precedent — a fresh, purely additive table (not part
 * of the original 5-table scope) for a feature that doesn't exist in the old system.
 *
 * Deliberately time-based rather than a boolean/flag: a conversation is considered
 * deleted only until a message newer than `deleted_at` arrives, at which point it
 * naturally reappears — matching real WhatsApp Web (deleting a chat doesn't stop the
 * other person from messaging you again) without needing any "undelete" logic.
 */
export const chatDeletions = mysqlTable(
  'whatsapp_chat_deletions',
  {
    id: int('id').autoincrement().primaryKey(),
    userAdminId: int('user_admin_id').notNull(),
    waNumber: varchar('wa_number', { length: 255 }).notNull(),
    mobile: varchar('mobile', { length: 255 }).notNull(),
    deletedAt: datetime('deleted_at').notNull(),
  },
  (table) => [uniqueIndex('chat_deletions_scope_idx').on(table.userAdminId, table.waNumber, table.mobile)],
)
