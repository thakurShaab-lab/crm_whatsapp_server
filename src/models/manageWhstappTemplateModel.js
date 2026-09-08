import { eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { manageWhstappTemplate } from '../schema/manageWhstappTemplate.js'

export async function findById(id) {
  const [row] = await db.select().from(manageWhstappTemplate).where(eq(manageWhstappTemplate.id, id)).limit(1)
  return row || null
}
