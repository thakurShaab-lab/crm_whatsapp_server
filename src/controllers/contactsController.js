import * as accountModel from '../models/accountModel.js'
import * as messagesModel from '../models/messagesModel.js'
import { toContactDto, isWindowExpired } from '../utils/mappers.js'
import { HttpError } from '../middleware/errorHandler.js'

export async function searchContacts(req, res) {
  const rows = await accountModel.searchAccounts({ userAdminId: req.userAdminId, search: req.query.search })
  res.json({
    items: rows.map((row) =>
      toContactDto(row.phone, row, null, { userAdminId: req.userAdminId, wabano: req.waNumber }),
    ),
  })
}

export async function getContact(req, res) {
  const { mobile } = req.params

  const [account, lastMessage, lastInboundReply] = await Promise.all([
    accountModel.findAccountByPhone({ userAdminId: req.userAdminId, mobile, countryCode: '91' }),
    messagesModel.getConversationSummary({ userAdminId: req.userAdminId, waNumber: req.waNumber, mobile }),
    messagesModel.findLastInboundReply({ mobile, waNumber: req.waNumber }),
  ])

  if (!account && !lastMessage) {
    throw new HttpError(404, 'Contact not found')
  }

  // `lastMessage.tmpName` is reliable here (not just on the true latest row) because
  // every outbound insert carries the known tmp_name forward too — see
  // messagesController.js's sendOne and outboundSend.js's sendAutoText.
  res.json(toContactDto(mobile, account, lastMessage?.tmpName, { windowExpired: isWindowExpired(lastInboundReply) }))
}
