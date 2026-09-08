import { and, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { stages } from '../schema/stages.js'

/** The pipeline's initial ("In Process", old_stage_id=1) lead stage for this admin. */
export async function findInitialLeadStage(userAdminId) {
  const [row] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.oldStageId, 1), eq(stages.userAdminId, userAdminId), eq(stages.sectionType, 'L')))
    .limit(1)
  return row || null
}
