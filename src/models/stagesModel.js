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

/** A specific stage's title, scoped to its owning admin — legacy's `Get_Single_Row("tbl_stages","user_admin_id='...' AND id='...'")` used to resolve a deal's `{{deal.stage}}` display text (helper.php ~line 366). */
export async function findByIdForAdmin({ userAdminId, id }) {
  const [row] = await db.select().from(stages).where(and(eq(stages.userAdminId, userAdminId), eq(stages.id, id))).limit(1)
  return row || null
}
