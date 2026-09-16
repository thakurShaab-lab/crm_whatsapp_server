import { and, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { automationLog } from '../schema/automationLog.js'

/**
 * Audit row for one automated template send mirrored onto another tenant's own WABA
 * number — legacy's only write to `tbl_automation_log` (helper.php's "Replica Copy
 * For Opposite Waba No" block, ~lines 975-986). `sourceId`/`stageId`/`secType`/
 * `leadId`/`dealId` are the ORIGINAL trigger's own values (not re-derived from the
 * receiving side), exactly as legacy passes through `$source_id`/`$stage_id`/
 * `$sec_type`/`$lead_id`/`$deal_id`.
 */
export async function insertLog({ sourceId, stageId, userAdminId, secType, accountId, leadId, dealId, mobile }) {
  await db.insert(automationLog).values({
    sourceId: Number(sourceId) || 0,
    stageId: Number(stageId) || 0,
    userAdminId,
    secType,
    accountId: accountId || 0,
    leadId: leadId || 0,
    dealId: dealId || 0,
    mobile,
    recvDate: new Date(),
  })
}

/** Permanently removes this tenant's automation-log rows for one contact — used when hard-deleting a conversation. */
export async function deleteByMobile({ userAdminId, mobile }) {
  await db.delete(automationLog).where(and(eq(automationLog.userAdminId, userAdminId), eq(automationLog.mobile, mobile)))
}
