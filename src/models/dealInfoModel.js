import { eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { dealInfo } from '../schema/dealInfo.js'

/** A deal by its own id — legacy's `deal_info_id in (...)` recipient join for a deal-stage-change automation trigger (helper.php's `sec_type='3'` branch). */
export async function findById(dealInfoId) {
  const [row] = await db.select().from(dealInfo).where(eq(dealInfo.dealInfoId, dealInfoId)).limit(1)
  return row || null
}

/** First deal for an account — legacy takes whichever row MySQL returns first (no ORDER BY), matched here. Both `{{deal.*}}` template-variable resolution and the per-deal WA-template counters key off account_id, not deal_info_id. */
export async function findByAccountId(accountId) {
  const [row] = await db.select().from(dealInfo).where(eq(dealInfo.accountId, accountId)).limit(1)
  return row || null
}

/**
 * Same bookkeeping as accountModel.recordTemplateSent/leadsModel.recordTemplateSent,
 * for the deal row. Legacy runs this unconditionally alongside the account/lead
 * updates whenever a `tbl_deal_info` row exists for the account being messaged —
 * helper.php ~lines 708-726 and 768-786 (and their "no variables" branch duplicates
 * at ~1351-1369/1411-1429) — regardless of which section_type actually triggered
 * the send.
 */
export async function recordTemplateSent({ accountId, templateId }) {
  const [row] = await db
    .select({ waTemplateCount: dealInfo.waTemplateCount, sentWaTemplateId: dealInfo.sentWaTemplateId })
    .from(dealInfo)
    .where(eq(dealInfo.accountId, accountId))
    .limit(1)
  if (!row) return

  const existingIds = row.sentWaTemplateId ? row.sentWaTemplateId.split(',') : []
  const sentWaTemplateId = existingIds.includes(String(templateId)) ? row.sentWaTemplateId : [...existingIds, templateId].filter(Boolean).join(',')

  await db
    .update(dealInfo)
    .set({ waTemplateCount: (row.waTemplateCount || 0) + 1, waTemplateSentDt: new Date(), sentWaTemplateId })
    .where(eq(dealInfo.accountId, accountId))
}
