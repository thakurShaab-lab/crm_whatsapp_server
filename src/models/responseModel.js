import { eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { whatsappResponse } from '../schema/index.js'

/**
 * `whatsapp_response` is the raw-webhook staging table legacy's
 * whatsapp_aisense_response.php writes to first, before any parsing: the exact
 * request body is persisted with status='N', so a payload is never lost even if
 * downstream parsing/processing throws. `markProcessed` flips it to 'Y' once the
 * webhook has been fully handled (see legacy's `$resp_qry_upd` at the very end of
 * its per-payload processing).
 */
export async function insertRawResponse({ response, recvDate = new Date() }) {
  const result = await db.insert(whatsappResponse).values({
    response: JSON.stringify(response),
    recvDate,
    status: 'N',
  })
  const insertId = Array.isArray(result) ? result[0].insertId : result.insertId
  return insertId
}

export async function markProcessed(sl) {
  await db.update(whatsappResponse).set({ status: 'Y' }).where(eq(whatsappResponse.sl, sl))
}
