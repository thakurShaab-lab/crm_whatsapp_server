import * as messagesModel from '../models/messagesModel.js'
import * as accountModel from '../models/accountModel.js'
import * as logModel from '../models/logModel.js'
import * as sentResponseModel from '../models/sentResponseModel.js'
import * as employeesModel from '../models/employeesModel.js'
import { sendMessage as sendVendorMessage } from '../vendors/vendorAdapter.js'
import { storeUploadedFiles } from '../utils/mediaStorage.js'
import { sanitizePlainText } from '../utils/sanitize.js'
import { getIsdFromMobile } from '../utils/isdCodes.js'
import { toMessageDto, toContactDto, USER_TYPE_TO_FOR } from '../utils/mappers.js'
import { encodeCursor, decodeCursor } from '../utils/pagination.js'
import { HttpError } from '../middleware/errorHandler.js'
import { emitNewMessage } from '../socket/emitters.js'
import { buildConversationSummaryDto } from './conversationsController.js'

const PAGE_SIZE = 50

/*
 * The legacy CRM opens a chat as `whatsapp_chat.php?wanum=...&ctrId=...&refid=...&useradminid=...&wabano=...`
 * (plus display-only flags: def, view, cname, viewfrom, is_chat, is_on_right). This
 * mirrors that route as query params on the REST thread-fetch endpoint: values that
 * double as another route's identifier (wanum/useradminid/wabano) are cross-checked
 * against this request's own tenant scope, and `refid`/`ctrId` are used to resolve the
 * real `tbl_account` row and scope the message query, instead of guessing by phone.
 */
export async function listThreadMessages(req, res) {
  const { mobile } = req.params
  const { cursor, limit, ctrId, for: forType, refid, cname, wanum, useradminid, wabano } = req.query

  // Route-level `validate()` coerces these via zod, but Express re-derives `req.query`
  // as fresh strings on every access, so the coercion doesn't survive — re-coerce here,
  // same as `limit` already does below.
  const ctrIdNum = ctrId != null ? Number(ctrId) : null
  const refidNum = refid != null ? Number(refid) : null
  const useradminidNum = useradminid != null ? Number(useradminid) : null

  if (wanum && wanum !== mobile) {
    throw new HttpError(400, `wanum (${wanum}) does not match the conversation being opened (${mobile})`)
  }
  if (useradminidNum != null && useradminidNum !== req.userAdminId) {
    throw new HttpError(403, 'useradminid does not match the current agent context')
  }
  if (wabano && wabano !== req.waNumber) {
    throw new HttpError(403, 'wabano does not match the current agent context')
  }

  const decoded = decodeCursor(cursor)
  const pageSize = limit ? Number(limit) : PAGE_SIZE

  const rows = await messagesModel.listThreadMessages({
    userAdminId: req.userAdminId,
    waNumber: req.waNumber,
    mobile,
    countryCode: ctrIdNum,
    cursor: decoded?.sl,
    limit: pageSize,
  })

  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor({ sl: last.sl }) : null

  // refid (account_id) comes straight from the CRM record the chat was opened from —
  // when present it's the real identity, no phone-matching guess needed.
  const account = refidNum
    ? await accountModel.findAccountById({ userAdminId: req.userAdminId, accountId: refidNum })
    : await accountModel.findAccountByPhone({ userAdminId: req.userAdminId, mobile, countryCode: ctrIdNum ?? '91' })

  if (account && forType && account.userType != null) {
    const resolvedFor = USER_TYPE_TO_FOR[account.userType]
    if (resolvedFor && resolvedFor !== forType) {
      throw new HttpError(400, `for=${forType} does not match this account's actual type (${resolvedFor})`)
    }
  }

  // Batched so a page of messages never does one status lookup per row.
  const sentStatusMap = await sentResponseModel.findLatestStatusMap(page.map((row) => row.sourceId))

  // DB returns newest-first for keyset pagination; the client renders oldest-to-newest.
  const items = page.map((row) => toMessageDto(row, sentStatusMap.get(row.sourceId))).reverse()
  const contact = toContactDto(mobile, account, cname, {
    countryCode: ctrIdNum ?? page[0]?.countryCode ?? null,
    userAdminId: req.userAdminId,
    wabano: req.waNumber,
  })

  res.json({ items, nextCursor, contact })
}

/**
 * "Replica copy for opposite WABA number" from the legacy send flow: when the
 * recipient is itself a configured WABA number belonging to another employee, the
 * same send is also mirrored into that employee's own thread as a received message.
 * Legacy only does this from the AiSensy/Netcore send path, not Gupshup's.
 */
async function mirrorForOppositeWaba({ mobile, legacyType, text, media, sourceId, ctrId, accountId, senderName }) {
  const otherEmployee = await employeesModel.findEmployeeByWabaNo(mobile)
  if (!otherEmployee) return

  await messagesModel.insertMessage({
    response: 'Waba msg received',
    name: senderName,
    accountId,
    mobile: mobile, // the other employee's own WABA number, from their perspective
    type: legacyType,
    text,
    waNumber: mobile,
    sendBy: otherEmployee.empId,
    userAdminId: otherEmployee.empId,
    msgtype: 'R',
    mediaType: media?.mime || '',
    imageUrl: media?.url || '',
    sourceType: '',
    sourceId,
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
    vendorType: otherEmployee.whatsappVendor,
    countryCode: ctrId,
    autoTemplateCount: 0,
    autoTemplateFailedDate: '1970-01-01',
    templateSentStatusDate: '1970-01-01',
    templateSentAmountMktg: 0,
    templateSentAmountUtlty: 0,
    waUtilityAmt: 0,
    waMktgAmt: 0,
  })
}

async function sendOne({ req, mobile, type, text, media, ctrId, accountId }) {
  let vendorResult
  try {
    vendorResult = await sendVendorMessage({ employee: req.employee, mobile, type, text, media })
  } catch (error) {
    // Otherwise this lands as a generic "Internal server error" (500s mask their
    // message) and the composer can't show the real reason the vendor rejected it.
    throw new HttpError(502, error.message)
  }

  await logModel.insertApiLog({
    userAdminId: req.userAdminId,
    apiUrlUse: `whatsapp_send_${req.vendorCode}`,
    apiUrl: vendorResult.endpoint,
    jsonData: { mobile, type, text, mediaUrl: media?.url },
    jsonResponse: vendorResult.responseBody,
  })

  const legacyType = type === 'text' ? 'T' : media.type // I | V | A | D
  const resolvedMobile = vendorResult.resolvedMobile || mobile
  const messageText = type === 'text' ? text : media.originalFilename

  const inserted = await messagesModel.insertMessage({
    response: `${type === 'text' ? 'Sent' : 'Media sent'} from Agent`,
    name: req.employee.firstName,
    mobile: resolvedMobile,
    accountId,
    type: legacyType,
    text: messageText,
    waNumber: req.waNumber,
    sendBy: req.employeeId,
    userAdminId: req.userAdminId,
    msgtype: 'S',
    mediaType: media?.mime || '',
    imageUrl: media?.url || '',
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
    vendorType: req.vendorCode === 'N' ? 'G' : req.vendorCode,
    countryCode: ctrId,
    autoTemplateCount: 0,
    autoTemplateFailedDate: '1970-01-01',
    templateSentStatusDate: '1970-01-01',
    templateSentAmountMktg: 0,
    templateSentAmountUtlty: 0,
    waUtilityAmt: 0,
    waMktgAmt: 0,
  })

  // Only the AiSensy/Netcore send path carries this behavior in legacy.
  if (req.employee.whatsappVendor === 'A' || req.employee.whatsappVendor === 'C') {
    await mirrorForOppositeWaba({
      mobile: resolvedMobile,
      legacyType,
      text: messageText,
      media,
      sourceId: vendorResult.sourceId,
      ctrId,
      accountId,
      senderName: req.employee.firstName,
    })
  }

  const dto = toMessageDto(inserted)
  const conversation = await buildConversationSummaryDto({ userAdminId: req.userAdminId, waNumber: req.waNumber, mobile: resolvedMobile })
  emitNewMessage(req.waNumber, { mobile: resolvedMobile, message: dto, conversation })
  return dto
}

/*
 * Composer text and each attached file become independent messages (one row per
 * WhatsApp message, matching both real WhatsApp and the legacy one-type-per-row schema).
 */
export async function sendMessage(req, res) {
  const { mobile } = req.params
  const text = sanitizePlainText(req.body.text)
  const files = req.files?.length ? await storeUploadedFiles(req.userAdminId, req.files) : []

  if (!text && files.length === 0) {
    throw new HttpError(400, 'Message must contain text or at least one file')
  }

  // Legacy derives the country code from the phone number itself, falling back to
  // the posted ctrId only when that detection comes up empty.
  const ctrId = getIsdFromMobile(mobile) || '91'

  const account = await accountModel.findAccountByPhone({ userAdminId: req.userAdminId, mobile, countryCode: ctrId })
  if (account?.stopService === 'Y') {
    throw new HttpError(409, 'This contact opted out (STOP) and cannot be messaged')
  }
  const accountId = account?.accountId ?? 0

  const sent = []
  if (text) sent.push(await sendOne({ req, mobile, type: 'text', text, ctrId, accountId }))
  for (const media of files) {
    sent.push(
      await sendOne({
        req,
        mobile,
        type: { I: 'image', V: 'video', A: 'audio', D: 'document' }[media.type],
        media,
        ctrId,
        accountId,
      }),
    )
  }

  res.status(201).json({ messages: sent })
}
