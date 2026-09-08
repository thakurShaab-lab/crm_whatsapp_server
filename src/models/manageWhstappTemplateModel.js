import { and, desc, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { manageWhstappTemplate } from '../schema/manageWhstappTemplate.js'

export async function findById(id) {
  const [row] = await db.select().from(manageWhstappTemplate).where(eq(manageWhstappTemplate.id, id)).limit(1)
  return row || null
}

/** Approved, AiSensy-vendor templates an employee can pick from in the "Send Approved Template" popup. */
export async function findApprovedForEmployee(userAdminId) {
  return db
    .select()
    .from(manageWhstappTemplate)
    .where(and(eq(manageWhstappTemplate.clientId, userAdminId), eq(manageWhstappTemplate.status, 'Y'), eq(manageWhstappTemplate.templateVendor, 'A')))
    .orderBy(desc(manageWhstappTemplate.id))
}
