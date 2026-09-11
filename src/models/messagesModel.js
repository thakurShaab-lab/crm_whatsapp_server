import { and, asc, desc, eq, gt, gte, isNotNull, lt, or, like, max, count } from 'drizzle-orm'
import { db } from '../config/db.js'
import { messages } from '../schema/messages.js'

function scope({ userAdminId, waNumber }) {
  return [eq(messages.userAdminId, userAdminId), eq(messages.waNumber, waNumber)]
}

/**
 * One row per contact (mobile): latest message + unread inbound count, forward-
 * paginated by (last message time, mobile). Built as a pure Drizzle grouped
 * subquery + join — the same "MAX(recvDate) GROUP BY mobile, then join back"
 * shape the legacy PHP itself used, just expressed without a raw SQL string.
 */
export async function listConversations({ userAdminId, waNumber, search, unreadOnly, cursor, limit }) {
  const baseConditions = scope({ userAdminId, waNumber })
  if (search) {
    baseConditions.push(or(like(messages.name, `%${search}%`), like(messages.mobile, `%${search}%`)))
  }

  const latest = db
    .select({ mobile: messages.mobile, maxRecvDate: max(messages.recvDate).as('maxRecvDate') })
    .from(messages)
    .where(and(...baseConditions))
    .groupBy(messages.mobile)
    .as('latest')

  const unread = db
    .select({ mobile: messages.mobile, unreadCount: count().as('unreadCount') })
    .from(messages)
    .where(and(...scope({ userAdminId, waNumber }), eq(messages.msgtype, 'R'), eq(messages.readStatus, 'U')))
    .groupBy(messages.mobile)
    .as('unread')

  const joinCondition = and(
    eq(messages.mobile, latest.mobile),
    eq(messages.recvDate, latest.maxRecvDate),
    ...scope({ userAdminId, waNumber }),
  )

  const outerConditions = []
  if (cursor) {
    outerConditions.push(
      or(
        lt(latest.maxRecvDate, cursor.recvDate),
        and(eq(latest.maxRecvDate, cursor.recvDate), lt(latest.mobile, cursor.mobile)),
      ),
    )
  }
  if (unreadOnly) {
    outerConditions.push(gt(unread.unreadCount, 0))
  }

  let query = db
    .select({
      sl: messages.sl,
      mobile: messages.mobile,
      name: messages.name,
      tmpName: messages.tmpName,
      countryCode: messages.countryCode,
      type: messages.type,
      text: messages.text,
      msgtype: messages.msgtype,
      status: messages.status,
      sourceId: messages.sourceId,
      recvDate: messages.recvDate,
      unreadCount: unread.unreadCount,
    })
    .from(latest)
    .innerJoin(messages, joinCondition)
    .leftJoin(unread, eq(unread.mobile, latest.mobile))

  if (outerConditions.length > 0) {
    query = query.where(and(...outerConditions))
  }

  const rows = await query.orderBy(desc(latest.maxRecvDate), desc(latest.mobile)).limit(limit + 1)
  return rows
}

/** Latest message + unread count for exactly one contact — used to refresh the sidebar after a new message/status change. */
export async function getConversationSummary({ userAdminId, waNumber, mobile }) {
  const conditions = and(...scope({ userAdminId, waNumber }), eq(messages.mobile, mobile))

  const [lastMessage] = await db.select().from(messages).where(conditions).orderBy(desc(messages.sl)).limit(1)
  if (!lastMessage) return null

  const [{ unreadCount }] = await db
    .select({ unreadCount: count() })
    .from(messages)
    .where(and(conditions, eq(messages.msgtype, 'R'), eq(messages.readStatus, 'U')))

  return { ...lastMessage, unreadCount }
}

/**
 * The customer's own name for this conversation — `tmp_name` on the most recent
 * message that actually has one set (never an employee's name; see
 * webhooksController.js's processInboundMessage, the only place a fresh value is
 * ever captured, straight from the customer's WhatsApp profile). Every outbound
 * send carries this same value forward onto its own row (see messagesController.js's
 * sendOne, outboundSend.js, etc.), so in practice this only ever needs to look past
 * the true latest row when nothing has captured a name yet at all — but it's a
 * direct lookup either way, not a guess.
 */
export async function findLatestTmpName({ userAdminId, waNumber, mobile }) {
  const [row] = await db
    .select({ tmpName: messages.tmpName })
    .from(messages)
    .where(and(...scope({ userAdminId, waNumber }), eq(messages.mobile, mobile), isNotNull(messages.tmpName)))
    .orderBy(desc(messages.recvDate))
    .limit(1)
  return row?.tmpName || null
}

/**
 * Every message in this conversation whose `recvDate` falls in the calendar-day
 * window `[fromBoundary, toBoundary)` — see utils/dateWindow.js. `sl` (not
 * `recvDate`) breaks ties for messages sharing the exact same timestamp, since it's
 * a strictly-increasing insert-order id and therefore a stable secondary sort key.
 * Ascending order: this is the exact page the client renders, oldest-first,
 * no client-side reversal needed.
 */
export async function listThreadMessagesByWindow({ userAdminId, waNumber, mobile, countryCode, fromBoundary, toBoundary }) {
  const conditions = [
    ...scope({ userAdminId, waNumber }),
    eq(messages.mobile, mobile),
    gte(messages.recvDate, fromBoundary),
    lt(messages.recvDate, toBoundary),
  ]
  if (countryCode != null) conditions.push(eq(messages.countryCode, Number(countryCode)))

  return db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(asc(messages.recvDate), asc(messages.sl))
}

/** Whether this conversation has any message older than `boundary` — drives `hasMore`, independent of whether the just-fetched window itself had any messages (a day, or even the whole 3-day window, can be empty while older history still exists). */
export async function hasMessagesBefore({ userAdminId, waNumber, mobile, countryCode, boundary }) {
  const conditions = [...scope({ userAdminId, waNumber }), eq(messages.mobile, mobile), lt(messages.recvDate, boundary)]
  if (countryCode != null) conditions.push(eq(messages.countryCode, Number(countryCode)))

  const [row] = await db.select({ sl: messages.sl }).from(messages).where(and(...conditions)).limit(1)
  return Boolean(row)
}

export async function findMessageBySl(sl) {
  const [row] = await db.select().from(messages).where(eq(messages.sl, sl)).limit(1)
  return row || null
}

/**
 * Looks up the message a vendor status webhook (delivered/read/failed) is about.
 * `source_id` has no uniqueness constraint, and `mirrorForOppositeWaba` (see
 * messagesController.js's sendOne) deliberately inserts a second row with the
 * *same* sourceId — msgtype 'R', a same-account "you sent this to your own WABA
 * number" log copy, not the real outbound send. A status webhook is always about
 * the real outbound message (msgtype 'S'), so that's preferred whenever more than
 * one row shares a sourceId; falling back to the first (oldest) match otherwise.
 */
export async function findMessageBySourceId(sourceId) {
  const rows = await db.select().from(messages).where(eq(messages.sourceId, sourceId)).orderBy(asc(messages.sl))
  if (rows.length === 0) return null
  return rows.find((row) => row.msgtype === 'S') || rows[0]
}

/** Most recent genuine inbound reply from this contact — used to decide whether a utility template still falls in WhatsApp's 24-hour free service window. */
export async function findLastInboundReply({ mobile, waNumber }) {
  const [row] = await db
    .select({ recvDate: messages.recvDate })
    .from(messages)
    .where(and(eq(messages.mobile, mobile), eq(messages.waNumber, waNumber), eq(messages.msgtype, 'R')))
    .orderBy(desc(messages.sl))
    .limit(1)
  return row || null
}

/** Total genuine inbound messages ever received from this contact on this WABA — called after the current message is already inserted, so a result of exactly 1 means this is their first message ever. */
export async function countInboundMessages({ userAdminId, waNumber, mobile }) {
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .where(and(...scope({ userAdminId, waNumber }), eq(messages.mobile, mobile), eq(messages.msgtype, 'R')))
  return Number(row?.total || 0)
}

/** Every `source_id` this conversation's messages carry — used to also clean up their tick-status rows on a hard delete. */
export async function findSourceIdsForConversation({ userAdminId, waNumber, mobile }) {
  const rows = await db
    .select({ sourceId: messages.sourceId })
    .from(messages)
    .where(and(...scope({ userAdminId, waNumber }), eq(messages.mobile, mobile)))
  return rows.map((row) => row.sourceId).filter(Boolean)
}

/**
 * Permanently deletes every message row for this conversation — a real, irreversible
 * DELETE (not a hide/soft-delete flag), scoped exactly like every other query here
 * (userAdminId + waNumber + mobile) so it can never reach another tenant's or
 * another WABA's rows. Returns the number of rows removed.
 */
export async function deleteConversation({ userAdminId, waNumber, mobile }) {
  const result = await db.delete(messages).where(and(...scope({ userAdminId, waNumber }), eq(messages.mobile, mobile)))
  return Array.isArray(result) ? result[0].affectedRows : result.affectedRows
}

/**
 * Backfills ownership after the fact — exactly the legacy's two-phase flow: a message
 * row is inserted first, then `UPDATE whatsapp_incoming_reply_response SET send_by=...,
 * lead_id=..., is_insert='Y' WHERE sl=...` once the CRM account/lead resolution
 * (leadAutoCreation.js) has run.
 */
export async function updateOwnership({ sl, sendBy, userAdminId, accountId, leadId }) {
  await db
    .update(messages)
    .set({ sendBy, userAdminId, accountId, leadId, isInsert: 'Y', insertDate: new Date() })
    .where(eq(messages.sl, sl))
}

export async function insertMessage(values) {
  const result = await db.insert(messages).values(values)
  const insertId = Array.isArray(result) ? result[0].insertId : result.insertId
  return findMessageBySl(insertId)
}

/** Marks every unread inbound message in this thread as agent-read; returns the affected `sl`s. */
export async function markAgentRead({ userAdminId, waNumber, mobile }) {
  const conditions = and(
    ...scope({ userAdminId, waNumber }),
    eq(messages.mobile, mobile),
    eq(messages.msgtype, 'R'),
    eq(messages.readStatus, 'U'),
  )

  const unreadRows = await db.select({ sl: messages.sl }).from(messages).where(conditions)
  if (unreadRows.length === 0) return []

  await db.update(messages).set({ readStatus: 'R' }).where(conditions)
  return unreadRows.map((row) => row.sl)
}