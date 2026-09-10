/**
 * Turns one composer submission (trimmed text + zero or more staged files) into the
 * list of actual messages to create — the one place the "text + one image = ONE
 * media message with a caption, never a separate text message" rule lives, so it's
 * directly testable without touching the DB or any vendor API.
 *
 * - No files: the text becomes its own text message (unchanged from before).
 * - One or more files: text (if any, after trimming whitespace) becomes the first
 *   file's caption; every other file sends caption-less — there's no per-file
 *   caption input in this composer, so a second file can't meaningfully carry the
 *   same caption as the first without misrepresenting what the user typed.
 *
 * Returns `[]` for empty input (caller is expected to have already rejected that
 * as a 400, matching the existing "Message must contain text or at least one
 * file" check).
 */
export function buildSendPlan({ text, files }) {
  const trimmedText = (text || '').trim()
  const items = files || []

  if (items.length === 0) {
    return trimmedText ? [{ kind: 'text', text: trimmedText }] : []
  }

  return items.map((media, index) => ({
    kind: 'media',
    media,
    caption: index === 0 ? trimmedText || null : null,
  }))
}
