import { eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { leads } from '../schema/leads.js'

/** First lead for an account — legacy takes whichever row MySQL returns first (no ORDER BY), matched here. */
export async function findLeadByAccountId(accountId) {
  const [row] = await db.select().from(leads).where(eq(leads.accountId, accountId)).limit(1)
  return row || null
}

export async function insertLead(values) {
  const result = await db.insert(leads).values(values)
  return Array.isArray(result) ? result[0].insertId : result.insertId
}
