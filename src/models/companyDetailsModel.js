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

/** This employee's own company display name — used as the auto-created account/contact/lead name for the "Replica Copy For Opposite Waba No" mirror flow (helper.php's `$get_comp_detail->company_name`). */
export async function findCompanyName(employeeId) {
  const [row] = await db.select({ companyName: companyDetails.companyName }).from(companyDetails).where(eq(companyDetails.employeeId, employeeId)).limit(1)
  return row?.companyName || null
}
