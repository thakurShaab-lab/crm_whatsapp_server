import * as messagesModel from '../models/messagesModel.js'
import * as sentResponseModel from '../models/sentResponseModel.js'
import * as accountModel from '../models/accountModel.js'
import * as logModel from '../models/logModel.js'
import { toMessageDto, mapMsgStatusToTickStatus, TICK_STATUS_TO_MSG_STATUS } from '../utils/mappers.js'
import { sanitizePlainText } from '../utils/sanitize.js'
import { HttpError } from '../middleware/errorHandler.js'
import { emitNewMessage, emitStatusUpdate, emitConversationRead } from '../socket/emitters.js'
import { isContactActive } from '../socket/activeSubscriptions.js'
import { buildConversationSummaryDto } from './conversationsController.js'
import { findEmployeeById, findEmployeeByWabaNo } from '../models/employeesModel.js'
import { parseAiSensyWebhook } from '../vendors/aisensyInbound.js'
import { resolveInboundOwnership } from '../services/leadAutoCreation.js'
import { sendAutoTextSafely } from '../services/outboundSend.js'
import * as companyDetailsModel from '../models/companyDetailsModel.js'
import { config } from '../config/index.js'

const INBOUND_TYPE_TO_LEGACY = { text: 'T', button: 'B', image: 'I', video: 'V', audio: 'A', document: 'D' }

/**
 * Meta's Cloud API webhook verification handshake (AiSensy passes it through
 * unchanged): when you register the callback URL on their dashboard, they GET it
 * once with `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge` — the
 * server must echo back the challenge as plain text if the token matches, or the
 * webhook registration is rejected. Not a real per-request auth mechanism, just a
 * one-time "yes, this URL really belongs to you" check.
 */
export function verifyWebhookSubscription(req, res) {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (!config.webhookVerifyToken) {
    throw new HttpError(500, 'WEBHOOK_VERIFY_TOKEN is not configured on this server')
  }
  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    return res.status(200).type('text/plain').send(challenge)
  }
  throw new HttpError(403, 'Webhook verification token mismatch')
}

const STATUS_RANK = { sending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }

/**
 * Single entry point for every post-send status transition (delivered/read/failed),
 * used identically by the real vendor webhook route and the dev-only simulate route.
 * Writes to `whatsapp_sent_response` exactly as the real vendor delivery-status feed
 * does (keyed by `external_id` = the message's `source_id`), and is idempotent: a
 * status at or behind the current one is a no-op, guarding against vendor
 * retries/out-of-order delivery.
 */
async function processStatusEvent({ waNumber, vendorMessageId, status, statusRemark, occurredAt }) {
  const message = await messagesModel.findMessageBySourceId(vendorMessageId)
  if (!message) throw new HttpError(404, `No message found for vendorMessageId "${vendorMessageId}"`)
  if (STATUS_RANK[status] == null) throw new HttpError(400, `Unknown status "${status}"`)

  const currentStatusRow = await sentResponseModel.findLatestStatus(vendorMessageId)
  const currentStatus = currentStatusRow ? mapMsgStatusToTickStatus(currentStatusRow.msgStatus) : (message.status === 'Y' ? 'sent' : 'sending')
  if (STATUS_RANK[status] <= STATUS_RANK[currentStatus]) {
    return toMessageDto(message, currentStatusRow)
  }

  await sentResponseModel.insertStatusEvent({
    externalId: vendorMessageId,
    phoneNo: message.mobile,
    msgStatus: TICK_STATUS_TO_MSG_STATUS[status],
    statusRemark: statusRemark || '',
    vendorType: message.vendorType,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
  })

  const newStatusRow = await sentResponseModel.findLatestStatus(vendorMessageId)
  const dto = toMessageDto(message, newStatusRow)
  emitStatusUpdate(waNumber, { mobile: message.mobile, messageId: message.sl, status: dto.status })
  return dto
}

/**
 * Inbound customer message arriving via a vendor webhook (or the dev simulator).
 * `msgtype` defaults to 'R' (received) but AiSensy's `smb_message_echoes` field
 * means the business's own message was echoed back — stored as 'S' (sent), matching
 * legacy. A non-null `stopService` (from a detected opt-out button reply) updates
 * the matching CRM account.
 */
async function processInboundMessage({ userAdminId, waNumber, contact, message, msgtype = 'R', stopService = null, vendorType = 'G' }) {
  if (stopService != null) {
    await accountModel.setStopService({ userAdminId, mobile: contact.mobile, countryCode: contact.countryCode, stopService })
  }

  // Resolved below (real inbound messages only — not our own echoed sends, which have
  // no real customer profile to create a lead from) and backfilled onto the row via
  // messagesModel.updateOwnership, exactly matching the legacy's insert-then-update flow.
  let ownership = null

  const inserted = await messagesModel.insertMessage({
    response: 'Received',
    name: contact.name || contact.mobile,
    mobile: contact.mobile,
    type: INBOUND_TYPE_TO_LEGACY[message.type] || 'T',
    text: message.type === 'text' || message.type === 'button' ? sanitizePlainText(message.text) : message.filename || '',
    waNumber,
    accountId: 0,
    sendBy: config.defaultEmployeeId,
    userAdminId,
    msgtype,
    readStatus: 'U',
    mediaType: message.mime || '',
    imageUrl: message.mediaUrl || '',
    sourceType: '',
    sourceId: message.vendorMessageId || '',
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
    vendorType,
    countryCode: contact.countryCode ? Number(contact.countryCode) : 91,
    autoTemplateCount: 0,
    autoTemplateFailedDate: '1970-01-01',
    templateSentStatusDate: '1970-01-01',
    templateSentAmountMktg: 0,
    templateSentAmountUtlty: 0,
    waUtilityAmt: 0,
    waMktgAmt: 0,
  })

  if (msgtype === 'R') {
    ownership = await resolveInboundOwnership({
      userAdminId,
      mobile: contact.mobile,
      countryCode: contact.countryCode || '91',
      profileName: contact.name,
    })
    await messagesModel.updateOwnership({
      sl: inserted.sl,
      sendBy: ownership.jrId,
      userAdminId,
      accountId: ownership.accountId,
      leadId: ownership.leadId,
    })

    // "Chk Auto Response Message" (whatsapp_aisense_response.php ~line 1898): a
    // per-employee canned auto-reply, sent on every inbound message when configured
    // and enabled — opt-in (autoRespDisp defaults to 'P', not 'Y'), so this is a
    // no-op for the vast majority of employees. Never allowed to break receipt of
    // the real inbound message it's replying to.
    const autoResponseText = await companyDetailsModel.findEnabledAutoResponse(userAdminId)
    if (autoResponseText) {
      const employee = await findEmployeeById(userAdminId)
      sendAutoTextSafely({
        employee,
        userAdminId,
        waNumber,
        mobile: contact.mobile,
        countryCode: contact.countryCode,
        text: autoResponseText,
        accountId: ownership.accountId,
      })
    }
  }

  const dto = toMessageDto(ownership ? { ...inserted, sendBy: ownership.jrId, accountId: ownership.accountId, leadId: ownership.leadId } : inserted)
  const conversation = await buildConversationSummaryDto({ userAdminId, waNumber, mobile: contact.mobile })
  emitNewMessage(waNumber, { mobile: contact.mobile, message: dto, conversation })

  // If an agent already has this thread open, treat it as read immediately instead of
  // leaving it to bump the unread badge until they switch back to this tab.
  if (isContactActive(waNumber, contact.mobile)) {
    const messageIds = await messagesModel.markAgentRead({ userAdminId, waNumber, mobile: contact.mobile })
    if (messageIds.length > 0) {
      emitConversationRead(waNumber, { mobile: contact.mobile, readAt: new Date().toISOString(), messageIds })
    }
  }

  return dto
}

/**
 * Shared dispatch used by both the real webhook route and the dev simulate route, so
 * they behave identically. `payload.event` is 'inbound' or a status name.
 */
export async function handleIncomingWebhook({ userAdminId, waNumber, payload }) {
  if (payload.event === 'inbound') {
    return processInboundMessage({
      userAdminId,
      waNumber,
      contact: payload.contact,
      message: payload.message,
      msgtype: payload.msgtype,
      stopService: payload.stopService,
      vendorType: payload.vendorType,
    })
  }
  return processStatusEvent({
    waNumber,
    vendorMessageId: payload.vendorMessageId,
    status: payload.event,
    statusRemark: payload.statusRemark,
    occurredAt: payload.occurredAt,
  })
}

/**
 * AiSensy's real webhook sends its own raw payload shape (Meta Cloud API format),
 * not the internal `{event, contact, message}` shape `handleIncomingWebhook` expects
 * — parseAiSensyWebhook translates it. The employee/business is resolved from the
 * WABA number in the payload itself (`metadata.display_phone_number`), same as
 * legacy, since a webhook call carries no auth/session context of its own.
 */
async function receiveAiSensyWebhook(req, res) {
  // TEMPORARY diagnostic capture: logs the exact raw payload AiSensy sends, before
  // any parsing — so a payload-shape mismatch (which the rest of this function
  // otherwise ACKs silently, by design, so the vendor doesn't retry) is actually
  // visible. Safe to remove once inbound messages are confirmed working.
  await logModel
    .insertApiLog({
      userAdminId: config.defaultUserAdminId,
      apiUrlUse: 'aisensy_webhook_raw_capture',
      jsonData: req.body,
    })
    .catch(() => {})

  const displayPhoneNumber = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number
  const employee = displayPhoneNumber ? await findEmployeeByWabaNo(displayPhoneNumber) : null
  if (!employee) {
    // Not one of ours (or a payload shape with nothing to act on) — ack anyway so
    // the vendor doesn't retry.
    return res.status(200).json({ ok: true, result: null })
  }

  const parsed = await parseAiSensyWebhook(req.body, { employee, userAdminId: employee.empId })
  if (!parsed) return res.status(200).json({ ok: true, result: null })

  const result = await handleIncomingWebhook({
    userAdminId: employee.empId,
    waNumber: parsed.waNumber,
    payload: { ...parsed, vendorType: 'A' },
  })
  res.status(200).json({ ok: true, result })
}

// Webhook callers are the vendor itself, not an authenticated agent — resolve the
// single configured business number directly rather than via agentContext, except
// for AiSensy which resolves it from the payload (see receiveAiSensyWebhook).
export async function receiveVendorWebhook(req, res) {
  if (req.params.vendor === 'A') {
    return receiveAiSensyWebhook(req, res)
  }

  const employee = await findEmployeeById(config.defaultEmployeeId)
  const result = await handleIncomingWebhook({
    userAdminId: config.defaultUserAdminId,
    waNumber: employee.whatsappWabano,
    payload: req.body,
  })
  res.status(200).json({ ok: true, result })
}