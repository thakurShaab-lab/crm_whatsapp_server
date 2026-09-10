import { refreshAiSensyTokenIfNeeded } from './aisensyToken.js'
import { config } from '../config/index.js'

// Legacy uses different attachment-type casing/vocabulary per vendor — matched
// exactly from code.php's two branches (send_text_other for C/A, send_text for G).
const AISENSY_NETCORE_ATTACHMENT_TYPE = { image: 'image', video: 'video', audio: 'audio', document: 'document' }
const GUPSHUP_ATTACHMENT_TYPE = { image: 'IMAGE', video: 'VIDEO', audio: 'AUDIO', document: 'DOCUMENT' }
const GUPSHUP_FILE_TYPE_LABEL = { image: 'Image', video: 'Video', audio: 'Audio', document: 'Document' }

export function requirePublicMediaUrl(relativeUrl) {
  if (!config.publicMediaBaseUrl) {
    throw new Error(
      'Cannot send media: PUBLIC_MEDIA_BASE_URL is not configured. Vendor APIs fetch attachments themselves ' +
        'from a URL and cannot reach localhost — set PUBLIC_MEDIA_BASE_URL to this server\'s real public HTTPS origin.',
    )
  }
  return `${config.publicMediaBaseUrl}${relativeUrl}`
}

// --- Gupshup (legacy `send_text` branch) -----------------------------------------

async function gupshupOptIn({ employee, mobile }) {
  const url = new URL('https://mediaapi.smsgupshup.com/GatewayAPI/rest')
  url.searchParams.set('method', 'OPT_IN')
  url.searchParams.set('format', 'json')
  url.searchParams.set('userid', employee.whatsappApiUsername)
  url.searchParams.set('password', employee.whatsappApiPassword)
  url.searchParams.set('phone_number', mobile)
  url.searchParams.set('v', '1.1')
  url.searchParams.set('auth_scheme', 'plain')
  url.searchParams.set('channel', 'WHATSAPP')
  // Legacy never checks this response — it's a fire-and-forget precondition call.
  await fetch(url).catch(() => {})
}

async function sendViaGupshup({ employee, mobile, type, text, media, caption }) {
  await gupshupOptIn({ employee, mobile })

  let requestUrl
  if (type !== 'text') {
    // Legacy hand-encodes the media URL (not the whole query string) before
    // splicing it into the request — replicated exactly rather than relying on
    // URLSearchParams, which would encode it differently.
    const absoluteUrl = requirePublicMediaUrl(media.url)
    const encodedMediaUrl = absoluteUrl.replace('://', '%3A%2F%2F').replaceAll('/', '%2F')
    // A real user-typed caption takes priority; the generic "Dear Sir..." line is
    // legacy's own existing default for a caption-less send, kept as-is so sending
    // media without a caption still behaves exactly like before.
    const resolvedCaption = caption || `Dear Sir,%0APlease check this ${GUPSHUP_FILE_TYPE_LABEL[type]}.`
    requestUrl =
      `https://mediaapi.smsgupshup.com/GatewayAPI/rest?userid=${encodeURIComponent(employee.whatsappApiUsername)}` +
      `&password=${encodeURIComponent(employee.whatsappApiPassword)}&send_to=${encodeURIComponent(mobile)}` +
      `&v=1.1&format=json&msg_type=${GUPSHUP_ATTACHMENT_TYPE[type]}&method=SENDMEDIAMESSAGE` +
      `&caption=${encodeURIComponent(resolvedCaption)}&media_url=${encodedMediaUrl}`
  } else {
    const url = new URL('https://mediaapi.smsgupshup.com/GatewayAPI/rest')
    url.searchParams.set('method', 'SendMessage')
    url.searchParams.set('format', 'json')
    url.searchParams.set('userid', employee.whatsappApiUsername)
    url.searchParams.set('password', employee.whatsappApiPassword)
    url.searchParams.set('send_to', mobile)
    url.searchParams.set('v', '1.1')
    url.searchParams.set('auth_scheme', 'plain')
    url.searchParams.set('msg_type', 'DATA_TEXT')
    url.searchParams.set('msg', text)
    requestUrl = url.toString()
  }

  const response = await fetch(requestUrl)
  const data = await response.json()
  const result = data?.response

  if (result?.status !== 'success') {
    throw new Error(`Gupshup send failed: ${JSON.stringify(data)}`)
  }

  return { endpoint: requestUrl, sourceId: result.id, responseBody: data, resolvedMobile: result.phone || mobile }
}

// --- AiSensy (legacy `send_text_other` branch, vendor 'A') -----------------------

function buildAiSensyMediaPayload({ mobile, type, media, caption }) {
  const attachmentType = AISENSY_NETCORE_ATTACHMENT_TYPE[type]
  const link = requirePublicMediaUrl(media.url)
  // A real user-typed caption takes priority over the filename fallback (legacy's
  // own existing default for a caption-less send, kept as-is). Audio never carries
  // a caption on real WhatsApp either way.
  const resolvedCaption = caption || media.originalFilename
  if (type === 'document') {
    return { to: mobile, type: attachmentType, [attachmentType]: { caption: resolvedCaption, link, filename: 'wds' } }
  }
  if (type === 'audio') {
    return { to: mobile, type: attachmentType, [attachmentType]: { link } }
  }
  return { to: mobile, type: attachmentType, [attachmentType]: { caption: resolvedCaption, link } }
}

async function sendViaAiSensy({ employee, mobile, type, text, media, caption }) {
  const freshEmployee = await refreshAiSensyTokenIfNeeded(employee)

  const payload =
    type === 'text' ? { to: mobile, type: 'text', text: { body: text } } : buildAiSensyMediaPayload({ mobile, type, media, caption })

  const endpoint = 'https://backend.aisensy.com/direct-apis/t1/messages'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshEmployee.whatsappApiUsername}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  const sourceId = data?.messages?.[0]?.id

  if (!sourceId) {
    throw new Error(`AiSensy send failed: ${JSON.stringify(data)}`)
  }

  return { endpoint, sourceId, responseBody: data, resolvedMobile: mobile }
}

// --- Netcore (legacy `send_text_other` branch, vendor 'C') -----------------------

/** Port of legacy `netcore_func_optin_api()` from helper.php — fire-and-forget, like Gupshup's OPT_IN. */
async function netcoreOptIn({ mobile, authorizationKey }) {
  if (!mobile) return
  await fetch('https://waapi.pepipost.com/api/v2/consent/manage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authorizationKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'optin', recipients: [{ recipient: mobile, source: 'WEB' }] }),
  }).catch(() => {})
}

function buildNetcoreBody({ mobile, type, text, media, caption }) {
  return {
    message: [
      {
        recipient_whatsapp: mobile,
        recipient_type: 'individual',
        message_type: type === 'text' ? 'text' : 'media',
        ...(type === 'text'
          ? { type_text: [{ preview_url: 'false', content: text }] }
          : {
              type_media: [
                {
                  attachments: [
                    {
                      attachment_url: requirePublicMediaUrl(media.url),
                      // A real user-typed caption takes priority over the filename
                      // fallback (legacy's own existing default for a caption-less send).
                      caption: caption || media.originalFilename,
                      attachment_type: AISENSY_NETCORE_ATTACHMENT_TYPE[type],
                    },
                  ],
                },
              ],
            }),
      },
    ],
  }
}

async function sendViaNetcore({ employee, mobile, type, text, media, caption }) {
  await netcoreOptIn({ mobile, authorizationKey: employee.whatsappApiUsername })

  const endpoint = 'https://cpaaswa.netcorecloud.net/api/v2/message/nc'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${employee.whatsappApiUsername}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildNetcoreBody({ mobile, type, text, media, caption })),
  })
  const data = await response.json()
  const sourceId = data?.data?.id

  if (data?.status !== 'success' || !sourceId) {
    throw new Error(`Netcore send failed: ${JSON.stringify(data)}`)
  }

  return { endpoint, sourceId, responseBody: data, resolvedMobile: mobile }
}

// ----------------------------------------------------------------------------------

/**
 * Dispatches to the real vendor a `tbl_employees` row is configured for. Ports the
 * exact request shapes from the legacy `code.php` send handler for all three vendors.
 */
export async function sendMessage({ employee, mobile, type, text, media, caption }) {
  if (employee.whatsappVendor === 'A') return sendViaAiSensy({ employee, mobile, type, text, media, caption })
  if (employee.whatsappVendor === 'C') return sendViaNetcore({ employee, mobile, type, text, media, caption })
  return sendViaGupshup({ employee, mobile, type, text, media, caption })
}
