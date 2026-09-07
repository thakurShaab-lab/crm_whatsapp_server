import { saveMediaBuffer } from '../utils/mediaStorage.js'
import { refreshAiSensyTokenIfNeeded } from './aisensyToken.js'
import { getIsdFromMobile, getIsdFromIso2 } from '../utils/isdCodes.js'

// Exact list from the legacy webhook handler (whatsapp_aisense_response.php) —
// a button-reply's text is checked against these to detect a WhatsApp-native
// opt-out tap, in several languages.
const STOP_WORDS = [
  'Stop', 'قف', 'Arrêt', 'إيقاف الرسائل', 'إيقاف الرسالة', 'ايقاف الرسائل',
  'સંદેશો બંધ કરો', 'संदेश रोकें', 'Unsubscribe', 'Not Interested',
]
const STOP_PATTERN = new RegExp(STOP_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'iu')

/** Downloads media WhatsApp only hands you an id for — a separate call is required to fetch the actual bytes. */
async function downloadAiSensyMedia({ employee, mediaId, filename, userAdminId }) {
  const freshEmployee = await refreshAiSensyTokenIfNeeded(employee)

  const response = await fetch('https://backend.aisensy.com/direct-apis/t1/get-media?responseType=stream', {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshEmployee.whatsappApiUsername}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: mediaId }),
  })
  if (!response.ok) {
    throw new Error(`AiSensy get-media failed with status ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const mime = response.headers.get('content-type') || ''
  const saved = await saveMediaBuffer({
    userAdminId,
    subfolder: 'whatsapp_received_file', // separate from the outbound whatsapp_sent_file folder, matching legacy
    buffer,
    mime,
    filenameHint: filename,
  })
  return { url: saved.url, mime }
}

/**
 * `contacts[0].user_id` looks like "IN.9198..." — the prefix before the dot is an
 * ISO 3166-1 alpha-2 country code (e.g. "IN"), NOT a numeric ISD code, and must be
 * looked up. Previously this returned the raw ISO letters directly (e.g. "IN"),
 * which then hit `Number("IN")` -> NaN downstream and crashed the message insert
 * against the `country_code` INT column — silently dropping every inbound message.
 * Mirrors legacy's exact fallback chain: ISO2 lookup, then mobile-prefix detection,
 * then a hard '91' default.
 */
function extractCountryCode({ userId, mobile }) {
  const iso2 = userId?.split('.')[0]
  const fromIso2 = iso2 ? getIsdFromIso2(iso2) : ''
  if (fromIso2) return fromIso2

  const detected = getIsdFromMobile(mobile)
  return detected || '91'
}

/**
 * Extracts the message content + legacy single-letter type code for every message
 * kind AiSensy's webhook can deliver. `location` is rendered using this app's own
 * map-preview text convention (see client/src/utils/locationText.js) rather than
 * legacy's raw <iframe> embed, since this frontend already renders that format as a
 * map bubble and would otherwise show the iframe markup as literal text.
 */
function extractContent(messageType, messageValue) {
  if (messageType === 'text') return { legacyType: 'T', text: messageValue.text?.body || '' }
  if (messageType === 'interactive') return { legacyType: 'T', text: messageValue.interactive?.list_reply?.title || '' }
  if (messageType === 'button') return { legacyType: 'B', text: messageValue.button?.text || '' }
  if (messageType === 'sticker') return { legacyType: 'T', text: messageValue.referral?.welcome_message?.text || '' }
  if (messageType === 'reaction') return { legacyType: 'T', text: messageValue.reaction?.emoji || '' }
  if (messageType === 'location') {
    const { latitude, longitude } = messageValue.location || {}
    return { legacyType: 'T', text: `📍 Location: https://www.google.com/maps?q=${latitude},${longitude}` }
  }
  const mediaTypeMap = { image: 'I', audio: 'A', video: 'V', document: 'D' }
  if (mediaTypeMap[messageType]) {
    return { legacyType: mediaTypeMap[messageType], media: messageValue[messageType] }
  }
  return { legacyType: 'T', text: '' }
}

const INTERNAL_TYPE_BY_LEGACY = { T: 'text', B: 'button', I: 'image', A: 'audio', V: 'video', D: 'document' }

// English status words, matching what processStatusEvent's STATUS_RANK understands —
// AiSensy/Meta already send these exact lowercase words, so no translation is needed
// (legacy instead reduces this to a single uppercase letter for its own
// whatsapp_sent_response.msg_status column; that reduction happens one layer down,
// inside sentResponseModel, not here).
const KNOWN_STATUSES = new Set(['sent', 'delivered', 'read', 'failed'])

/**
 * Port of the status-webhook branch in whatsapp_aisense_response.php (the `else`
 * branch after the template-category-update check) — a delivery/read/failed
 * callback for a message this business sent. Legacy deliberately ignores the
 * vendor's own event timestamp and just records "now" (its `$recvdate` line
 * comments out the timestamp-based version) — replicated as-is, so no `occurredAt`
 * is set here either.
 */
function parseStatusEvent(value) {
  const statusEntry = value.statuses?.[0]
  if (!statusEntry) return null

  const waNumber = value.metadata?.display_phone_number
  const vendorMessageId = statusEntry.id
  const status = statusEntry.status
  if (!waNumber || !vendorMessageId || !KNOWN_STATUSES.has(status)) return null

  let statusRemark = status
  if (status === 'failed') {
    const err = statusEntry.errors?.[0]
    statusRemark = err ? `${err.code}: ${err.error_data?.details || ''}` : 'failed'
  }

  return { event: status, waNumber, vendorMessageId, statusRemark }
}

/**
 * Parses one AiSensy webhook call into the internal `handleIncomingWebhook` payload
 * shape. Covers the core "a message arrived" path and delivery/read/failed status
 * callbacks (see whatsapp_aisense_response.php's `messages`/`smb_message_echoes`
 * and status-callback handling) — template-category-update notifications and the
 * chatbot/journey automation engine in that file are intentionally not ported.
 * Legacy only ever reads index [0] of each array, never loops over multiple
 * entries/messages — replicated as-is.
 */
export async function parseAiSensyWebhook(rawBody, { employee, userAdminId }) {
  const change = rawBody?.entry?.[0]?.changes?.[0]
  const value = change?.value
  if (!value) return null

  if (value.statuses) return parseStatusEvent(value)

  const field = change.field
  const isEcho = field === 'smb_message_echoes'
  const messagesKey = isEcho ? 'message_echoes' : 'messages'
  const messageValue = value[messagesKey]?.[0]
  if (field !== 'smb_message_echoes' && field !== 'messages') return null // template_category_update etc. — nothing to store
  if (!messageValue) return null

  const waNumber = value.metadata?.display_phone_number
  const mobile = value.contacts?.[0]?.wa_id
  if (!waNumber || !mobile) return null

  const contactName = value.contacts?.[0]?.profile?.name || value.contacts?.[0]?.wa_id
  const countryCode = extractCountryCode({ userId: value.contacts?.[0]?.user_id, mobile })
  const messageType = messageValue.type
  const { legacyType, text, media } = extractContent(messageType, messageValue)

  let stopService = null
  if (legacyType === 'B') {
    stopService = STOP_PATTERN.test(text) ? 'Y' : 'N'
  }

  let messagePayload
  if (media) {
    const downloaded = await downloadAiSensyMedia({
      employee,
      mediaId: media.id,
      filename: media.filename,
      userAdminId,
    })
    messagePayload = {
      type: INTERNAL_TYPE_BY_LEGACY[legacyType],
      filename: media.filename || '',
      mime: downloaded.mime,
      mediaUrl: downloaded.url,
      vendorMessageId: media.id,
    }
  } else {
    messagePayload = { type: INTERNAL_TYPE_BY_LEGACY[legacyType], text }
  }

  return {
    event: 'inbound',
    waNumber,
    msgtype: isEcho ? 'S' : 'R',
    contact: { mobile, countryCode, name: contactName },
    message: messagePayload,
    stopService,
  }
}
