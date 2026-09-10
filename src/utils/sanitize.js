const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi

/**
 * Splits raw message text into plain-text and link segments so the frontend can
 * render URLs as real anchor elements instead of ever building/interpreting HTML
 * from user- or customer-supplied text (the legacy app used html_entity_decode
 * on stored message text, which is a stored XSS hole).
 */
export function linkifySegments(text) {
  if (!text) return []
  const segments = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) })
    }
    segments.push({ type: 'link', value: match[0] })
    lastIndex = start + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

/** Strips control characters and caps length; the value is still never rendered as HTML. */
export function sanitizePlainText(text, maxLength = 4096) {
  if (typeof text !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maxLength)
}

/**
 * Legacy rows store message bodies with literal `<br/>` line breaks (the old
 * textarea round-tripped through `nl2br`). Converted back to plain newlines here
 * so display code never has to interpret the text as HTML.
 */
export function normalizeLegacyText(text) {
  if (!text) return text
  return text.replace(/<br\s*\/?>/gi, '\n')
}

/**
 * A media message's WhatsApp-style caption is stored in `actual_name`
 * (`varchar(255)`, see messagesController.js's sendOne / webhooksController.js's
 * processInboundMessage) — a real column limit, unlike `sanitizePlainText`'s
 * generous default. `String.prototype.slice` counts UTF-16 code units, so a plain
 * `.slice(0, 255)` could cut a surrogate pair in half and corrupt the last
 * character of a long caption (most emoji are 2 code units); `Array.from` iterates
 * by code point instead, so truncation always lands on a whole character.
 */
export function sanitizeCaption(text, maxLength = 255) {
  const cleaned = sanitizePlainText(text, Number.POSITIVE_INFINITY).trim()
  if (!cleaned) return null
  const codePoints = Array.from(cleaned)
  return codePoints.length <= maxLength ? cleaned : codePoints.slice(0, maxLength).join('')
}
