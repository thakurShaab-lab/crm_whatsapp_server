import * as messagesModel from '../models/messagesModel.js'
import * as accountModel from '../models/accountModel.js'
import * as sentResponseModel from '../models/sentResponseModel.js'
import { toConversationSummaryDto } from '../utils/mappers.js'
import { encodeCursor, decodeCursor } from '../utils/pagination.js'
import { emitConversationRead } from '../socket/emitters.js'

const PAGE_SIZE = 30

/** Shared by the send/webhook controllers to refresh one sidebar row after a message changes. */
export async function buildConversationSummaryDto({ userAdminId, waNumber, mobile }) {
  const row = await messagesModel.getConversationSummary({ userAdminId, waNumber, mobile })
  if (!row) return null
  const [account, sentStatus] = await Promise.all([
    accountModel.findAccountByPhone({ userAdminId, mobile, countryCode: row.countryCode }),
    row.sourceId ? sentResponseModel.findLatestStatus(row.sourceId) : null,
  ])
  return toConversationSummaryDto(row, account, sentStatus, { userAdminId, wabano: waNumber })
}

export async function listConversations(req, res) {
  const { search, filter, cursor, limit } = req.query
  const decoded = decodeCursor(cursor)
  const pageSize = limit ? Number(limit) : PAGE_SIZE

  const rows = await messagesModel.listConversations({
    userAdminId: req.userAdminId,
    waNumber: req.waNumber,
    search,
    unreadOnly: filter === 'unread',
    cursor: decoded ? { recvDate: new Date(decoded.recvDate), mobile: decoded.mobile } : null,
    limit: pageSize,
  })

  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page[page.length - 1]

  // Batched so a page of conversations never does one status lookup per row.
  const sentStatusMap = await sentResponseModel.findLatestStatusMap(page.map((row) => row.sourceId))

  const items = await Promise.all(
    page.map(async (row) => {
      const account = await accountModel.findAccountByPhone({
        userAdminId: req.userAdminId,
        mobile: row.mobile,
        countryCode: row.countryCode,
      })
      return toConversationSummaryDto(row, account, sentStatusMap.get(row.sourceId), {
        userAdminId: req.userAdminId,
        wabano: req.waNumber,
      })
    }),
  )

  const nextCursor = hasMore && last ? encodeCursor({ recvDate: last.recvDate, mobile: last.mobile }) : null
  res.json({ items, nextCursor })
}

export async function markRead(req, res) {
  const { mobile } = req.params
  const messageIds = await messagesModel.markAgentRead({
    userAdminId: req.userAdminId,
    waNumber: req.waNumber,
    mobile,
  })

  const readAt = new Date().toISOString()
  if (messageIds.length > 0) {
    emitConversationRead(req.waNumber, { mobile, readAt, messageIds })
  }

  res.json({ mobile, readAt, messageIds })
}
