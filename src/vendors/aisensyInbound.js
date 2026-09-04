import { saveMediaBuffer } from '../utils/mediaStorage.js'
import { refreshAiSensyTokenIfNeeded } from './aisensyToken.js'
import { getIsdFromMobile } from '../utils/isdCodes.js'

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

function extractCountryCode({ userId, mobile }) {
  if (userId) {
    const isoCode = userId.split('.')[0]
    if (isoCode) return isoCode
  }
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

/**
 * Parses one AiSensy webhook call into the internal `handleIncomingWebhook` payload
 * shape. Only the core "a message arrived" path is handled here (see
 * whatsapp_aisense_response.php's `messages`/`smb_message_echoes` handling) —
 * template-category-update notifications and the chatbot/journey automation engine
 * in that file are intentionally not ported. Legacy only ever reads index [0] of
 * each array, never loops over multiple entries/messages — replicated as-is.
 */
export async function parseAiSensyWebhook(rawBody, { employee, userAdminId }) {
  const change = rawBody?.entry?.[0]?.changes?.[0]
  const value = change?.value
  if (!value) return null

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
