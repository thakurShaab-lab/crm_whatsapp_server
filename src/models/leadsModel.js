import { eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { leads } from '../schema/leads.js'

/** First lead for an account — legacy takes whichever row MySQL returns first (no ORDER BY), matched here. */
export async function findLeadByAccountId(accountId) {
  const [row] = await db.select().from(leads).where(eq(leads.accountId, accountId)).limit(1)
  return row || null
}

export async function findById(leadId) {
  const [row] = await db.select().from(leads).where(eq(leads.leadId, leadId)).limit(1)
  return row || null
}

export async function insertLead(values) {
  const result = await db.insert(leads).values(values)
  return Array.isArray(result) ? result[0].insertId : result.insertId
}

/** Same bookkeeping as accountModel.recordTemplateSent, for the lead row. */
export async function recordTemplateSent({ accountId, templateId }) {
  const [row] = await db.select({ waTemplateCount: leads.waTemplateCount, sentWaTemplateId: leads.sentWaTemplateId }).from(leads).where(eq(leads.accountId, accountId)).limit(1)
  if (!row) return

  const existingIds = row.sentWaTemplateId ? row.sentWaTemplateId.split(',') : []
  const sentWaTemplateId = existingIds.includes(String(templateId)) ? row.sentWaTemplateId : [...existingIds, templateId].filter(Boolean).join(',')

  await db
    .update(leads)
    .set({ waTemplateCount: (row.waTemplateCount || 0) + 1, waTemplateSentDt: new Date(), sentWaTemplateId })
    .where(eq(leads.accountId, accountId))
}
