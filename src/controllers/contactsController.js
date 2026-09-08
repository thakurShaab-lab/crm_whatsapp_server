import * as accountModel from '../models/accountModel.js'
import * as messagesModel from '../models/messagesModel.js'
import { toContactDto } from '../utils/mappers.js'
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

  const [account, lastMessage, outboundName] = await Promise.all([
    accountModel.findAccountByPhone({ userAdminId: req.userAdminId, mobile, countryCode: '91' }),
    messagesModel.getConversationSummary({ userAdminId: req.userAdminId, waNumber: req.waNumber, mobile }),
    messagesModel.findLatestOutboundName({ userAdminId: req.userAdminId, waNumber: req.waNumber, mobile }),
  ])

  if (!account && !lastMessage) {
    throw new HttpError(404, 'Contact not found')
  }

  res.json(toContactDto(mobile, account, null, { outboundName }))
}
