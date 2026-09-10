import { normalizeLegacyText } from './sanitize.js'

// Legacy single-letter `type` column -> the renderer key the frontend understands.
// F (template) and B (button-reply) carry plain/HTML text just like T, so they
// render as text too — there's no dedicated "template" bubble in WhatsApp Web itself.
const TYPE_MAP = { T: 'text', F: 'text', B: 'text', I: 'image', V: 'video', A: 'audio', D: 'document' }
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document'])

// Exactly `whatsapp_chatt_message_container.php`'s tick logic: msg_status R/S/D/F
// from the latest matching `whatsapp_sent_response` row (preferring 'R'), falling
// back to "sent" (a plain single check) when no such row exists yet.
const SENT_RESPONSE_STATUS_MAP = { R: 'read', D: 'delivered', S: 'sent', F: 'failed' }
export const TICK_STATUS_TO_MSG_STATUS = { sent: 'S', delivered: 'D', read: 'R', failed: 'F' }

// `tbl_account.user_type` only distinguishes Customer/Vendor in the live schema — the
// legacy `for=C/L/D` (customer/lead/deal) route param can't be fully reproduced without
// the separate lead/deal tables, which are out of scope for this build.
export const USER_TYPE_TO_FOR = { 1: 'C', 2: 'V' }

export function mapMsgStatusToTickStatus(msgStatus) {
  return SENT_RESPONSE_STATUS_MAP[msgStatus] || 'sent'
}

/** Same 24h-window rule as templateAutomation.js's `resolvePaidTemplateFlag`: no prior reply at all, or the last one being over 24h old, both mean the window is closed. `lastReply` comes from `messagesModel.findLastInboundReply`. */
export function isWindowExpired(lastReply) {
  if (!lastReply) return true
  const diffHours = (Date.now() - new Date(lastReply.recvDate).getTime()) / 3_600_000
  return diffHours > 24
}

/** `sentStatusRow` comes from sentResponseModel.findLatestStatus(s)/findLatestStatusMap — null if none exists yet. */
function deriveOutboundStatus(row, sentStatusRow) {
  if (sentStatusRow) return mapMsgStatusToTickStatus(sentStatusRow.msgStatus)
  return row.status === 'Y' ? 'sent' : 'sending'
}

export function toMessageDto(row, sentStatusRow = null) {
  const direction = row.msgtype === 'S' ? 'outbound' : 'inbound'
  const type = TYPE_MAP[row.type] || 'text'
  const isMedia = MEDIA_TYPES.has(type)
  const status = direction === 'outbound' ? deriveOutboundStatus(row, sentStatusRow) : 'delivered'

  return {
    id: row.sl,
    mobile: row.mobile,
    direction,
    type,
    // For a media message this is its WhatsApp-style caption — stored in the
    // existing (previously dormant, utf8mb4) `actual_name` column, deliberately
    // not `row.text`, which for media rows holds the file's own original filename
    // instead (exposed below as `media.filename`). The existing image/video/
    // document bubble components already render `message.text` as a caption
    // beneath the media when present, so this is the only mapping change rendering needs.
    text: isMedia ? normalizeLegacyText(row.actualName) : normalizeLegacyText(row.text),
    media: isMedia
      ? {
          url: row.imageUrl || null,
          filename: row.text || null,
          source: direction === 'inbound' ? 'vendor' : 'local',
        }
      : null,
    status,
    failedReason: status === 'failed' ? sentStatusRow?.statusRemark || null : null,
    vendorMessageId: row.sourceId || null,
    createdAt: row.recvDate,
  }
}

export function toConversationSummaryDto(row, account, sentStatusRow = null, context = {}) {
  return {
    mobile: row.mobile,
    // The customer's own WhatsApp display name (`tmp_name` — see messagesModel.js's
    // findLatestTmpName), falling back to their phone number. Deliberately not
    // `row.name` (that column's own send-time value isn't reliably the customer —
    // see messagesController.js's sendOne) and not the CRM account's name (an
    // account's business/company name, e.g. "Weblink.in Pvt Ltd", doesn't identify
    // which individual is on the other end anyway).
    name: row.tmpName || row.mobile,
    countryCode: row.countryCode,
    stopService: account ? account.stopService === 'Y' : false,
    unreadCount: Number(row.unreadCount) || 0,
    updatedAt: row.recvDate,
    // Identity fields the legacy `whatsapp_chat.php?...` route carries as query params
    // (refid, for, useradminid, wabano) — surfaced here so the sidebar can build that
    // same URL shape when opening a chat.
    accountId: account?.accountId ?? null,
    for: account ? USER_TYPE_TO_FOR[account.userType] || null : null,
    userAdminId: context.userAdminId ?? null,
    wabano: context.wabano ?? null,
    lastMessage: {
      type: TYPE_MAP[row.type] || 'text',
      text: MEDIA_TYPES.has(TYPE_MAP[row.type]) ? null : normalizeLegacyText(row.text),
      direction: row.msgtype === 'S' ? 'outbound' : 'inbound',
      status: row.msgtype === 'S' ? deriveOutboundStatus(row, sentStatusRow) : 'delivered',
      createdAt: row.recvDate,
    },
  }
}

export function toContactDto(mobile, account, tmpName, context = {}) {
  return {
    mobile,
    // The customer's own WhatsApp display name takes priority when this mobile has
    // any message history at all (see toConversationSummaryDto's comment); the CRM
    // account's contact name is still a reasonable fallback when it doesn't (e.g. the
    // "start new chat" search, which has no message history to have captured one from).
    name: tmpName || account?.contactPersonName || mobile,
    stopService: account ? account.stopService === 'Y' : false,
    accountId: account?.accountId ?? null,
    for: account ? USER_TYPE_TO_FOR[account.userType] || null : null,
    countryCode: context.countryCode ?? null,
    userAdminId: context.userAdminId ?? null,
    wabano: context.wabano ?? null,
    // True once WhatsApp's 24h customer-service window has closed since this
    // contact's last real inbound message (or they've never messaged at all) —
    // only a pre-approved template can be sent past this point.
    windowExpired: context.windowExpired ?? false,
  }
}
