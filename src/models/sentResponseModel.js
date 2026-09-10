import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../config/db.js'
import { sentResponse } from '../schema/sentResponse.js'

/**
 * Replicates `whatsapp_chatt_message_container.php`'s exact tick logic: prefer the
 * latest row with msg_status='R' (read) for a given external_id, otherwise fall back
 * to the latest row of any status. Batched across many source ids in one query so
 * rendering a page of messages never does one lookup per row.
 */
export async function findLatestStatusMap(sourceIds) {
  const ids = [...new Set(sourceIds.filter(Boolean))]
  if (ids.length === 0) return new Map()

  const rows = await db
    .select({ externalId: sentResponse.externalId, msgStatus: sentResponse.msgStatus, statusRemark: sentResponse.statusRemark, sl: sentResponse.sl })
    .from(sentResponse)
    .where(inArray(sentResponse.externalId, ids))
    .orderBy(desc(sentResponse.sl))

  const latestByExternalId = new Map()
  const readByExternalId = new Map()
  for (const row of rows) {
    if (!latestByExternalId.has(row.externalId)) latestByExternalId.set(row.externalId, row)
    if (row.msgStatus === 'R' && !readByExternalId.has(row.externalId)) readByExternalId.set(row.externalId, row)
  }

  const result = new Map()
  for (const externalId of ids) {
    result.set(externalId, readByExternalId.get(externalId) || latestByExternalId.get(externalId) || null)
  }
  return result
}

export async function findLatestStatus(sourceId) {
  const map = await findLatestStatusMap([sourceId])
  return map.get(sourceId) || null
}

/** Permanently removes every delivery-status row tied to the given message source ids — used when hard-deleting a conversation, so no orphaned tick-status rows are left behind. */
export async function deleteByExternalIds(sourceIds) {
  const ids = [...new Set(sourceIds.filter(Boolean))]
  if (ids.length === 0) return
  await db.delete(sentResponse).where(inArray(sentResponse.externalId, ids))
}

/** Appends a new delivery-status row — mirrors how the real vendor webhook feed writes this table. */
export async function insertStatusEvent({ externalId, phoneNo, msgStatus, statusRemark = '', statusCode, vendorType, occurredAt }) {
  await db.insert(sentResponse).values({
    response: `Status update: ${msgStatus}`,
    externalId,
    phoneNo,
    msgStatus,
    recvDate: occurredAt || new Date(),
    status: 'Y',
    statusRemark,
    statusCode: statusCode || null,
    vendorType,
  })
}
