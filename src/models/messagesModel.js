import { and, desc, eq, gt, lt, or, like, max, count, inArray } from 'drizzle-orm'
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

/**
 * Name recorded on each contact's own latest OUTBOUND row, batched across many mobiles
 * in one query. Used as a display-name fallback in place of "whichever row is newest
 * regardless of direction": some legacy inbound rows (auto-reply/button-click echoes)
 * log our own WABA account's name instead of the client's, while the name on an
 * outbound row comes from real CRM lead data about the client.
 */
export async function findLatestOutboundNameMap({ userAdminId, waNumber, mobiles }) {
  const list = [...new Set(mobiles.filter(Boolean))]
  if (list.length === 0) return new Map()

  const rows = await db
    .select({ mobile: messages.mobile, name: messages.name, sl: messages.sl })
    .from(messages)
    .where(and(...scope({ userAdminId, waNumber }), eq(messages.msgtype, 'S'), inArray(messages.mobile, list)))
    .orderBy(desc(messages.sl))

  const result = new Map()
  for (const row of rows) {
    if (!result.has(row.mobile)) result.set(row.mobile, row.name)
  }
  return result
}

export async function findLatestOutboundName({ userAdminId, waNumber, mobile }) {
  const map = await findLatestOutboundNameMap({ userAdminId, waNumber, mobiles: [mobile] })
  return map.get(mobile) || null
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