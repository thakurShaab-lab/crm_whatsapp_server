import { db } from '../config/db.js'
import { incomingReplyResponseLog } from '../schema/incomingReplyResponseLog.js'

/** Audit trail for every vendor API call attempt (real or simulated). */
export async function insertApiLog({ userAdminId, templateId = 0, apiUrl, apiUrlUse, jsonData, jsonResponse }) {
  await db.insert(incomingReplyResponseLog).values({
    userAdminId,
    templateId,
    apiUrl: apiUrl || null,
    apiUrlUse: apiUrlUse || null,
    jsonData: jsonData ? JSON.stringify(jsonData) : null,
    jsonResponse: jsonResponse ? JSON.stringify(jsonResponse) : null,
    receiveDate: new Date(),
  })
}
