import { eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { crmContacts } from '../schema/crmContacts.js'

/** `account_name` is actually the account_id FK in the live schema (see crmContacts.js). */
export async function findContactByAccountId(accountId) {
  const [row] = await db.select().from(crmContacts).where(eq(crmContacts.accountName, accountId)).limit(1)
  return row || null
}

export async function insertContact(values) {
  const result = await db.insert(crmContacts).values(values)
  return Array.isArray(result) ? result[0].insertId : result.insertId
}
