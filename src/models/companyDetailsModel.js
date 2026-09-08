import { and, eq, ne } from 'drizzle-orm'
import { db } from '../config/db.js'
import { companyDetails } from '../schema/companyDetails.js'

/** The configured canned auto-reply text for this employee, only if actually enabled (`autoRespDisp='Y'`) and non-empty. */
export async function findEnabledAutoResponse(employeeId) {
  const [row] = await db
    .select({ waAutoResponseMsg: companyDetails.waAutoResponseMsg })
    .from(companyDetails)
    .where(and(eq(companyDetails.employeeId, employeeId), eq(companyDetails.autoRespDisp, 'Y'), ne(companyDetails.waAutoResponseMsg, '')))
    .limit(1)
  return row?.waAutoResponseMsg || null
}
