import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../config/db.js'
import { automation } from '../schema/automation.js'

/**
 * Exactly the legacy rule lookup: an active automation rule for this admin/section
 * whose `source_ids` contains `sourceId` (and, for lead/deal sections, whose
 * `stage_ids` also contains `stageId`), most recently created first.
 */
export async function findMatchingRule({ userAdminId, sectionType, sourceId, stageId }) {
  const conditions = [
    eq(automation.status, 1),
    eq(automation.userAdminId, userAdminId),
    eq(automation.sectionType, sectionType),
    sql`FIND_IN_SET(${sourceId}, ${automation.sourceIds})`,
  ]
  if (sectionType === 2 || sectionType === 3) {
    conditions.push(sql`FIND_IN_SET(${stageId}, ${automation.stageIds})`)
  }

  const [row] = await db.select().from(automation).where(and(...conditions)).orderBy(desc(automation.id)).limit(1)
  return row || null
}
