import { asc, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { templateVariableName } from '../schema/templateVariableName.js'

/** A template's `{{N}}` placeholders in order — legacy has no ORDER BY, but a real table's natural row order is its insertion (id) order, which is what `{{1}}, {{2}}, ...` actually follows. */
export async function findForTemplate(templateId) {
  return db.select().from(templateVariableName).where(eq(templateVariableName.tid, templateId)).orderBy(asc(templateVariableName.id))
}
