import * as accountModel from '../models/accountModel.js'
import * as accountAddressesModel from '../models/accountAddressesModel.js'
import * as crmContactsModel from '../models/crmContactsModel.js'
import * as leadsModel from '../models/leadsModel.js'
import * as leadSourceModel from '../models/leadSourceModel.js'
import * as stagesModel from '../models/stagesModel.js'
import * as activityModel from '../models/activityModel.js'
import * as fbRoutingModel from '../models/fbRoutingModel.js'

/** Matches PHP's `preg_replace('/^'.$country_code.'/', '', $mobile)` — strips a leading ISD code of any length, not just India's. */
function stripCountryCode(mobile, countryCode) {
  if (!countryCode) return mobile
  return mobile.replace(new RegExp(`^${countryCode}`), '')
}

/**
 * Exactly `lead_insert_data_aisensy()` + its caller's owner-resolution block in
 * whatsapp_aisense_response.php (~lines 434-492, 1742-1887): every inbound WhatsApp
 * message resolves who owns it (`jrId`) and, the first time a mobile number ever
 * messages in, auto-creates its CRM account/address/contact/lead/activity records.
 *
 * Deliberately NOT replicated here (out of scope for this build, or a fix rather
 * than a faithful port):
 * - The two `send_automation_whatsapp_template()` calls (account-created / lead-created)
 *   and the push-notification send — template automation and push notifications are
 *   later, separate build phases.
 * - The Facebook-ads-specific `sourceID`/`headline` lead-source branch — this path is
 *   WhatsApp-only, so the lead source is always the "Whatsapp" row.
 * - The legacy `$lead_id` used in the caller's final UPDATE is actually an out-of-scope
 *   PHP variable (the real one lives inside `lead_insert_data_aisensy()`'s own local
 *   scope and is never returned) — every newly-created lead's `lead_id` column there
 *   silently ends up 0. This port returns the real, just-created lead id instead.
 *
 * @returns {Promise<{accountId: number, leadId: number, jrId: number, created: boolean}>}
 */
export async function resolveInboundOwnership({ userAdminId, mobile, countryCode, profileName }) {
  const lastTenMobile = stripCountryCode(mobile, countryCode)

  const existingAccount = await accountModel.findAccountByPhoneVariants({ userAdminId, mobile, lastTenMobile })
  if (existingAccount) {
    const existingLead = await leadsModel.findLeadByAccountId(existingAccount.accountId)
    const jrId = existingLead?.leadOwner > 0 ? existingLead.leadOwner : existingAccount.createdBy
    return { accountId: existingAccount.accountId, leadId: existingLead?.leadId || 0, jrId, created: false }
  }

  // Company name / lead title / contact first name, all in one — exactly `$comp_name`
  // in the legacy code: the WhatsApp-reported profile name (truncated to 20 chars),
  // or "NA/<mobile>" if the contact has none.
  const compName = profileName && profileName !== '.' ? profileName.slice(0, 20) : `NA/${mobile}`

  const sourceId = await leadSourceModel.findOrCreateWhatsappSource(userAdminId)
  const jrId = await fbRoutingModel.resolveRoundRobinOwner({ userAdminId, sourceId })

  const now = new Date()
  const accountId = await accountModel.insertAccount({
    accountName: compName,
    contactPersonName: compName,
    createdBy: jrId,
    userAdminId,
    accountOwner: jrId,
    phone: mobile,
    source: sourceId,
    sicCode: 'g',
    createdAt: now,
    status: 1,
    ctryIsdCode: String(countryCode || '91'),
  })

  await accountAddressesModel.insertPlaceholderAddress(accountId)

  let crmContact = await crmContactsModel.findContactByAccountId(accountId)
  if (!crmContact) {
    const contactId = await crmContactsModel.insertContact({
      firstName: compName,
      createdBy: jrId,
      userAdminId,
      accountName: accountId,
      phone: mobile,
      mobile,
      createdAt: now,
      modifyAt: now,
      status: 1,
    })
    crmContact = { contactId }
  }

  let leadId = 0
  const existingLeadForAccount = await leadsModel.findLeadByAccountId(accountId)
  if (!existingLeadForAccount) {
    const initialStage = await stagesModel.findInitialLeadStage(userAdminId)

    leadId = await leadsModel.insertLead({
      accountId,
      leadStatus: initialStage ? String(initialStage.id) : '',
      addedBy: jrId,
      userAdminId,
      leadOwner: jrId,
      contactId: crmContact.contactId,
      leadTitle: compName,
      firstName: compName,
      company: compName,
      mobile,
      leadSource: String(sourceId),
      createdAt: now,
      nextDueDate: now,
      nextDueDateAddBy: 'C',
      ctryIsdCode: String(countryCode || '91'),
      status: '1',
    })

    await activityModel.insertFreshPartyActivity({ jrId, userAdminId, leadId })
  } else {
    leadId = existingLeadForAccount.leadId
  }

  return { accountId, leadId, jrId, created: true }
}
