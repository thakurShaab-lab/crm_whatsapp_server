import * as messagesModel from '../models/messagesModel.js'
import * as logModel from '../models/logModel.js'
import { sendMessage as sendVendorMessage } from '../vendors/vendorAdapter.js'
import { toMessageDto } from '../utils/mappers.js'
import { emitNewMessage } from '../socket/emitters.js'
import { buildConversationSummaryDto } from '../controllers/conversationsController.js'

/**
 * Request-agnostic version of messagesController's `sendOne` — sends a plain text
 * message through the employee's configured vendor and inserts the outbound row,
 * for server-initiated sends that have no HTTP request to hang the vendor/tenant
 * context off of (the company auto-response message, in particular).
 */
export async function sendAutoText({ employee, userAdminId, waNumber, mobile, countryCode, text, accountId = 0 }) {
  const vendorResult = await sendVendorMessage({ employee, mobile, type: 'text', text })

  await logModel.insertApiLog({
    userAdminId,
    apiUrlUse: 'whatsapp_auto_response',
    apiUrl: vendorResult.endpoint,
    jsonData: { mobile, text },
    jsonResponse: vendorResult.responseBody,
  })

  const inserted = await messagesModel.insertMessage({
    response: 'Auto response sent',
    name: employee.firstName,
    mobile: vendorResult.resolvedMobile || mobile,
    accountId,
    type: 'T',
    text,
    waNumber,
    sendBy: employee.empId,
    userAdminId,
    msgtype: 'S',
    mediaType: '',
    imageUrl: '',
    sourceType: '',
    sourceId: vendorResult.sourceId,
    templateSentDate: '1970-01-01',
    templateSentTime: '00:00:00',
    templateDeliveredDate: '1970-01-01',
    templateDeliveredTime: '00:00:00',
    templateReadDate: '1970-01-01',
    templateReadTime: '00:00:00',
    templateFailedDate: '1970-01-01',
    templateFailedTime: '00:00:00',
    body: '',
    ctwaClid: '',
    headline: '',
    sourceUrl: '',
    replyRecvDate: new Date(),
    recvDate: new Date(),
    tid: '',
    insertDate: new Date(),
    status: 'Y',
    vendorType: employee.whatsappVendor === 'N' ? 'G' : employee.whatsappVendor,
    countryCode: countryCode ? Number(countryCode) : 91,
    autoTemplateCount: 0,
    autoTemplateFailedDate: '1970-01-01',
    templateSentStatusDate: '1970-01-01',
    templateSentAmountMktg: 0,
    templateSentAmountUtlty: 0,
    waUtilityAmt: 0,
    waMktgAmt: 0,
  })

  return toMessageDto(inserted)
}

/** Fire-and-forget wrapper: an auto-response failing (vendor error, etc.) must never break the real inbound message it's replying to. */
export async function sendAutoTextSafely(params) {
  try {
    const dto = await sendAutoText(params)
    const conversation = await buildConversationSummaryDto({ userAdminId: params.userAdminId, waNumber: params.waNumber, mobile: dto.mobile })
    emitNewMessage(params.waNumber, { mobile: dto.mobile, message: dto, conversation })
    return dto
  } catch {
    return null
  }
}
