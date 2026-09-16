import { desc, eq, inArray, or } from 'drizzle-orm'
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

/**
 * Removes every status row for a hard-deleted conversation in one statement: by
 * `external_id` (the message source ids being deleted) and, as a defense-in-depth
 * catch-all, by `phone_no` (always set to the same conversation mobile — see
 * webhooksController.js's `insertStatusEvent` call) for any status callback whose
 * `external_id` somehow never matched a message row. Deliberately one DELETE, not
 * two separate ones — running `external_id IN (...)` and `phone_no = ...` as
 * separate concurrent deletes against the same table was briefly tried and hit a
 * genuine MySQL deadlock (two statements locking the same table's rows in a
 * different order); a single statement has no such race.
 */
export async function deleteForConversation({ sourceIds, phoneNo }) {
  const ids = [...new Set((sourceIds || []).filter(Boolean))]
  if (ids.length === 0 && !phoneNo) return

  const conditions = []
  if (ids.length > 0) conditions.push(inArray(sentResponse.externalId, ids))
  if (phoneNo) conditions.push(eq(sentResponse.phoneNo, phoneNo))
  await db.delete(sentResponse).where(or(...conditions))
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
