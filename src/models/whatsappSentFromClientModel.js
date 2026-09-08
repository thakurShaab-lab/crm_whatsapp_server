import { db } from '../config/db.js'
import { whatsappSentFromClient } from '../schema/whatsappSentFromClient.js'

export async function insertSentLog(values) {
  await db.insert(whatsappSentFromClient).values(values)
}
