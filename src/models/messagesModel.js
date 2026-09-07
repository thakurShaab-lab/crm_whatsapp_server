import { and, desc, eq, gt, lt, or, like, max, count, isNull } from 'drizzle-orm'
import { db } from '../config/db.js'
import { messages } from '../schema/messages.js'
import { chatDeletions } from '../schema/chatDeletions.js'

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

  // A "deleted" conversation is hidden only up until a newer message arrives — once
  // the latest message postdates the deletion, it reappears automatically (matching
  // real WhatsApp Web), so this is a comparison against maxRecvDate, not a flag.
  const deletions = db
    .select({ mobile: chatDeletions.mobile, deletedAt: chatDeletions.deletedAt })
    .from(chatDeletions)
    .where(and(eq(chatDeletions.userAdminId, userAdminId), eq(chatDeletions.waNumber, waNumber)))
    .as('deletions')

  const outerConditions = [or(isNull(deletions.deletedAt), gt(latest.maxRecvDate, deletions.deletedAt))]
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

  const query = db
    .select({
      sl: messages.sl,
      mobile: messages.mobile,
      name: messages.name,
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
    .leftJoin(deletions, eq(deletions.mobile, latest.mobile))
    .where(and(...outerConditions))

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

export async function listThreadMessages({ userAdminId, waNumber, mobile, countryCode, cursor, limit }) {
  const conditions = [...scope({ userAdminId, waNumber }), eq(messages.mobile, mobile)]
  if (countryCode != null) conditions.push(eq(messages.countryCode, Number(countryCode)))
  if (cursor) conditions.push(lt(messages.sl, cursor))

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.sl))
    .limit(limit + 1)

  return rows
}

export async function findMessageBySl(sl) {
  const [row] = await db.select().from(messages).where(eq(messages.sl, sl)).limit(1)
  return row || null
}

export async function findMessageBySourceId(sourceId) {
  const [row] = await db.select().from(messages).where(eq(messages.sourceId, sourceId)).limit(1)
  return row || null
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