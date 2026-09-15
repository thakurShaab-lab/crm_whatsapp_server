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
 * - The push-notification send (send_mobile_notification_android/ios) — skipped per
 *   an explicit decision (no FCM credentials configured for this project).
 * - The Facebook-ads-specific `sourceID`/`headline` lead-source branch — this path is
 *   WhatsApp-only, so the lead source is always the "Whatsapp" row.
 * - The legacy `$lead_id` used in the caller's final UPDATE is actually an out-of-scope
 *   PHP variable (the real one lives inside `lead_insert_data_aisensy()`'s own local
 *   scope and is never returned) — every newly-created lead's `lead_id` column there
 *   silently ends up 0. This port returns the real, just-created lead id instead.
 *
 * The `send_automation_whatsapp_template()` trigger itself no longer lives here —
 * see templateAutomation.js's `triggerFirstMessageAutomation`, called once per
 * conversation from webhooksController based on actual message history, not on
 * whether a CRM record happened to be created (an account/lead can already exist —
 * e.g. imported — for a mobile that has never actually messaged in before).
 * `sourceId`/`leadStageId` are still returned here since that caller needs them.
 *
 * @returns {Promise<{accountId: number, leadId: number, jrId: number, sourceId: number, leadStageId: string, created: boolean}>}
 */
export async function resolveInboundOwnership({ userAdminId, mobile, countryCode, profileName }) {
  const lastTenMobile = stripCountryCode(mobile, countryCode)

  const existingAccount = await accountModel.findAccountByPhoneVariants({ userAdminId, mobile, lastTenMobile })
  if (existingAccount) {
    const existingLead = await leadsModel.findLeadByAccountId(existingAccount.accountId)
    const jrId = existingLead?.leadOwner > 0 ? existingLead.leadOwner : existingAccount.createdBy
    const sourceId = await leadSourceModel.findOrCreateWhatsappSource(userAdminId)
    return {
      accountId: existingAccount.accountId,
      leadId: existingLead?.leadId || 0,
      jrId,
      sourceId,
      leadStageId: existingLead?.leadStatus || '',
      created: false,
    }
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
  let leadStageId = ''
  const existingLeadForAccount = await leadsModel.findLeadByAccountId(accountId)
  if (!existingLeadForAccount) {
    const initialStage = await stagesModel.findInitialLeadStage(userAdminId)
    leadStageId = initialStage ? String(initialStage.id) : ''

    leadId = await leadsModel.insertLead({
      accountId,
      leadStatus: leadStageId,
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
    leadStageId = existingLeadForAccount.leadStatus || ''
  }

  return { accountId, leadId, jrId, sourceId, leadStageId, created: true }
}

/**
 * "Replica Copy For Opposite Waba No" (helper.php ~lines 845-990, `sec_type`-agnostic
 * — the same block runs after every successful automated template send): when the
 * number just messaged is itself another tenant's own primary WABA number, that
 * tenant's side needs its own CRM account/contact/lead for *our* WABA number, so the
 * mirrored "received" message (see templateAutomation.js) can be attributed to it.
 * This is the same find-or-create shape as `resolveInboundOwnership` above, except
 * ownership: legacy assigns the new account/contact/lead directly to
 * `sent_user_admin_id` (the receiving tenant's own admin id), never a round-robin
 * employee — there is no `fbinq_forwarding_tbl` routing in this flow.
 *
 * @returns {Promise<{accountId: number, leadId: number}>}
 */
export async function resolveOrCreateReplicaAccount({ targetUserAdminId, mobile, countryCode, companyName }) {
  const lastTenMobile = stripCountryCode(mobile, countryCode)

  const existingAccount = await accountModel.findAccountByPhoneVariants({ userAdminId: targetUserAdminId, mobile, lastTenMobile })
  if (existingAccount) {
    const existingLead = await leadsModel.findLeadByAccountId(existingAccount.accountId)
    return { accountId: existingAccount.accountId, leadId: existingLead?.leadId || 0 }
  }

  const sourceId = await leadSourceModel.findOrCreateWhatsappSource(targetUserAdminId)
  const now = new Date()

  const accountId = await accountModel.insertAccount({
    accountName: companyName,
    contactPersonName: companyName,
    createdBy: targetUserAdminId,
    userAdminId: targetUserAdminId,
    accountOwner: targetUserAdminId,
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
      firstName: companyName,
      createdBy: targetUserAdminId,
      userAdminId: targetUserAdminId,
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
    const initialStage = await stagesModel.findInitialLeadStage(targetUserAdminId)
    const leadStageId = initialStage ? String(initialStage.id) : ''

    leadId = await leadsModel.insertLead({
      accountId,
      leadStatus: leadStageId,
      addedBy: targetUserAdminId,
      userAdminId: targetUserAdminId,
      leadOwner: targetUserAdminId,
      contactId: crmContact.contactId,
      leadTitle: companyName,
      firstName: companyName,
      company: companyName,
      mobile,
      leadSource: String(sourceId),
      createdAt: now,
      nextDueDate: now,
      nextDueDateAddBy: 'C',
      ctryIsdCode: String(countryCode || '91'),
      status: '1',
    })

    await activityModel.insertFreshPartyActivity({ jrId: targetUserAdminId, userAdminId: targetUserAdminId, leadId })
  } else {
    leadId = existingLeadForAccount.leadId
  }

  return { accountId, leadId }
}
