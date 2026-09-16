import { and, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { whatsappSentFromClient } from '../schema/whatsappSentFromClient.js'

export async function insertSentLog(values) {
  await db.insert(whatsappSentFromClient).values(values)
}

/** Permanently removes this tenant's template-send audit rows for one recipient — used when hard-deleting a conversation. */
export async function deleteBySendTo({ userAdminId, mobile }) {
  await db.delete(whatsappSentFromClient).where(and(eq(whatsappSentFromClient.userAdminId, userAdminId), eq(whatsappSentFromClient.sendTo, mobile)))
}
