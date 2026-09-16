import * as messagesModel from '../models/messagesModel.js'
import * as accountModel from '../models/accountModel.js'
import * as sentResponseModel from '../models/sentResponseModel.js'
import * as whatsappSentFromClientModel from '../models/whatsappSentFromClientModel.js'
import * as automationLogModel from '../models/automationLogModel.js'
import * as ncJourneyTrackerModel from '../models/ncJourneyTrackerModel.js'
import * as ncJourneyTrackLogModel from '../models/ncJourneyTrackLogModel.js'
import { toConversationSummaryDto } from '../utils/mappers.js'
import { encodeCursor, decodeCursor } from '../utils/pagination.js'
import { deleteMediaFile } from '../utils/mediaStorage.js'
import { emitConversationRead, emitConversationDeleted } from '../socket/emitters.js'

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
  const { search, filter, fromDate, toDate, cursor, limit } = req.query
  const decoded = decodeCursor(cursor)
  const pageSize = limit ? Number(limit) : PAGE_SIZE

  const rows = await messagesModel.listConversations({
    userAdminId: req.userAdminId,
    waNumber: req.waNumber,
    search,
    unreadOnly: filter === 'unread',
    // Only meaningful for the "Date Filter" tab, but harmless to pass through
    // regardless of `filter`'s value — listConversations only applies a bound
    // when it's actually present.
    fromDate: filter === 'dateRange' ? fromDate : null,
    toDate: filter === 'dateRange' ? toDate : null,
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

/**
 * Hard delete — permanently removes every piece of data this app itself stores
 * about this conversation: the messages, their delivery-status ("tick") rows,
 * template-send audit rows, any opposite-WABA automation-log rows, any in-progress
 * chatbot/journey tracker state, and the actual media files (images/videos/audio/
 * documents) those messages reference on disk — not just the DB rows pointing at
 * them. Irreversible: there is no separate "deleted" flag, and no undo. Deliberately
 * does NOT touch the CRM's own account/lead/contact record for this phone number —
 * that's a separate business entity outside "this chat"'s own data.
 */
export async function deleteConversation(req, res) {
  const { mobile } = req.params
  const { userAdminId, waNumber } = req

  const [sourceIds, mediaUrls, journeyTrackIds] = await Promise.all([
    messagesModel.findSourceIdsForConversation({ userAdminId, waNumber, mobile }),
    messagesModel.findMediaUrlsForConversation({ userAdminId, waNumber, mobile }),
    ncJourneyTrackerModel.findTrackIdsForMobile({ wabaNumber: waNumber, clientMobile: mobile }),
  ])

  await ncJourneyTrackLogModel.deleteByTrackIds(journeyTrackIds)

  await Promise.all([
    sentResponseModel.deleteForConversation({ sourceIds, phoneNo: mobile }),
    whatsappSentFromClientModel.deleteBySendTo({ userAdminId, mobile }),
    automationLogModel.deleteByMobile({ userAdminId, mobile }),
    ncJourneyTrackerModel.deleteByMobile({ wabaNumber: waNumber, clientMobile: mobile }),
  ])

  const deletedCount = await messagesModel.deleteConversation({ userAdminId, waNumber, mobile })

  // Best-effort file cleanup — runs after the DB rows are gone, and a failure to
  // remove any one file must never fail the request (the conversation is already
  // deleted at this point; see deleteMediaFile's own error handling).
  await Promise.allSettled(mediaUrls.map((url) => deleteMediaFile(url)))

  emitConversationDeleted(waNumber, { mobile })
  res.json({ mobile, deletedCount })
}
