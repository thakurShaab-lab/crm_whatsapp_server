import { db } from '../config/db.js'
import { chatDeletions } from '../schema/chatDeletions.js'

/**
 * Records "this conversation was deleted right now" — upserted, so deleting an
 * already-deleted (and not-yet-reappeared) chat again just bumps the timestamp
 * rather than erroring or accumulating rows.
 */
export async function hideConversation({ userAdminId, waNumber, mobile }) {
  await db
    .insert(chatDeletions)
    .values({ userAdminId, waNumber, mobile, deletedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { deletedAt: new Date() } })
}
