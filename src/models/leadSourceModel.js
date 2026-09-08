import { and, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { leadSource } from '../schema/leadSource.js'

export async function findById(sid) {
  const [row] = await db.select().from(leadSource).where(eq(leadSource.sid, sid)).limit(1)
  return row || null
}

/** Find-or-create the "Whatsapp" lead source row for this admin — every WhatsApp-originated lead is tagged with it. */
export async function findOrCreateWhatsappSource(userAdminId) {
  const [existing] = await db
    .select()
    .from(leadSource)
    .where(and(eq(leadSource.createdBy, userAdminId), eq(leadSource.title, 'Whatsapp')))
    .limit(1)
  if (existing) return existing.sid

  const result = await db.insert(leadSource).values({
    createdBy: userAdminId,
    title: 'Whatsapp',
    fbHeadingName: '',
    status: '1',
    apiType: '',
  })
  return Array.isArray(result) ? result[0].insertId : result.insertId
}
