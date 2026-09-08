import { sql } from 'drizzle-orm'
import { db } from '../config/db.js'
import * as automationModel from '../models/automationModel.js'
import * as manageWhstappTemplateModel from '../models/manageWhstappTemplateModel.js'
import * as templateVariableNameModel from '../models/templateVariableNameModel.js'
import * as accountModel from '../models/accountModel.js'
import * as leadsModel from '../models/leadsModel.js'
import * as employeesModel from '../models/employeesModel.js'
import * as leadSourceModel from '../models/leadSourceModel.js'
import * as crmWhatsappPermissionModel from '../models/crmWhatsappPermissionModel.js'
import * as whatsappCountryWiseChargeModel from '../models/whatsappCountryWiseChargeModel.js'
import * as whatsappSentFromClientModel from '../models/whatsappSentFromClientModel.js'
import * as messagesModel from '../models/messagesModel.js'
import * as logModel from '../models/logModel.js'
import { refreshAiSensyTokenIfNeeded } from '../vendors/aisensyToken.js'
import { logger } from '../utils/logger.js'
import { isWindowExpired } from '../utils/mappers.js'

// `template_variable_name.sec_type_field_name` and the raw CRM column names it
// carries are admin-configured data, not end-user input, but a raw identifier is
// still spliced into SQL below (mirroring legacy's own dynamic `SELECT $field FROM
// ...`) — this allowlist is defense in depth against a malformed/malicious config row.
const SAFE_IDENTIFIER = /^[a-zA-Z0-9_]+$/

async function selectRawField({ table, idColumn, idValue, field, orderBy }) {
  if (!SAFE_IDENTIFIER.test(field) || !SAFE_IDENTIFIER.test(table) || !SAFE_IDENTIFIER.test(idColumn)) return null
  if (orderBy && !SAFE_IDENTIFIER.test(orderBy)) return null

  const orderClause = orderBy ? sql.raw(` ORDER BY \`${orderBy}\` ASC`) : sql.raw('')
  const rows = await db.execute(
    sql`SELECT ${sql.raw('`' + field + '`')} FROM ${sql.raw('`' + table + '`')} WHERE ${sql.raw('`' + idColumn + '`')} = ${idValue}${orderClause} LIMIT 1`,
  )
  const row = (rows[0] || rows)[0]
  return row ? row[field] : null
}

/**
 * Resolves one `{{N}}` placeholder's value. `prefix` selects which CRM entity the
 * field lives on — exactly legacy's `cstmr`/`emp`/`cntct`/`lead` branches (from
 * `send_automation_whatsapp_template()` in helper.php). Two branches are
 * deliberately simplified: `industry`/`country` id-to-name lookups are left as the
 * raw id (no `tbl_industry`/country-name table provided), and `extra` (custom
 * fields) always returns 'NA' (`customer_extra_field`/`_value` not provided) — both
 * documented gaps rather than guessed-at table structures. `deal`/`vndr` are never
 * reached since this integration only ever calls with section_type 1 or 2.
 */
async function resolveVariableValue({ prefix, field, accountId, userAdminId, manualValue }) {
  if (!field) return ''

  // A manually-typed value from the "Send Approved Template" popup — the only
  // prefix a person ever fills in themselves; every other prefix is always
  // resolved from live CRM data regardless of what (if anything) was submitted,
  // exactly matching legacy's `$key_index0=='other'` branch.
  if (prefix === 'other') return manualValue ?? ''

  if (prefix === 'cstmr') {
    const value = await selectRawField({ table: 'tbl_account', idColumn: 'account_id', idValue: accountId, field })
    if (field === 'account_owner' && value > 0) {
      const owner = await employeesModel.findEmployeeById(value)
      return owner ? `${owner.firstName} ${owner.lastName}`.trim() : value
    }
    if (field === 'parent_account' && value > 0) {
      const parent = await accountModel.findAccountById({ userAdminId, accountId: value })
      return parent?.accountName ?? value
    }
    if (field === 'source' && value > 0) {
      const source = await leadSourceModel.findById(value)
      return source?.title ?? value
    }
    return value ?? ''
  }

  if (prefix === 'emp') {
    return (await selectRawField({ table: 'tbl_employees', idColumn: 'emp_id', idValue: userAdminId, field })) ?? ''
  }

  if (prefix === 'cntct') {
    return (await selectRawField({ table: 'tbl_contacts', idColumn: 'account_name', idValue: accountId, field, orderBy: 'contact_id' })) ?? ''
  }

  if (prefix === 'lead') {
    const value = await selectRawField({ table: 'tbl_leads', idColumn: 'account_id', idValue: accountId, field })
    if (field === 'lead_owner' && value > 0) {
      const owner = await employeesModel.findEmployeeById(value)
      return owner ? `${owner.firstName} ${owner.lastName}`.trim() : value
    }
    if (field === 'lead_source' && value > 0) {
      const source = await leadSourceModel.findById(value)
      return source?.title ?? value
    }
    return value ?? ''
  }

  if (prefix === 'extra') return 'NA'
  return ''
}

/** Exactly `func_whatsapp_send_aisense_api()`'s payload branching (button-url / variable+media / variable-only / media-only / plain). `mediaOverride` (from the "Send Approved Template" popup's optional file upload) takes precedence over the template's own configured media, matching legacy's `$temp_file_url` override. */
function buildAiSensyTemplatePayload({ template, whatsappNumber, attributeValues, accountId, mediaOverride }) {
  const attributesArr = attributeValues.map((value) => ({ type: 'text', text: value }))
  const base = {
    to: whatsappNumber,
    type: 'template',
    template: { language: { policy: 'deterministic', code: template.templateLanguage }, name: template.mainTemplateTitle, components: [] },
  }

  if (template.templateButtonUrl) {
    const dynamicText = template.isBtnUrlDynamic === 'Y' ? `${accountId}@weblink.in` : 'part-of-the-url'
    base.template.components = [
      { type: 'body', parameters: attributesArr },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: dynamicText }] },
    ]
    return base
  }

  const hasVariable = template.templateVariable > 0
  const mediaUrl = mediaOverride?.url || template.vendorMediaUrl
  const mediaType = mediaOverride?.mediaType || template.mediaType
  const mediaFilename = mediaOverride?.filename || template.mediaFilename
  const hasMedia = Boolean(mediaUrl)

  if (hasVariable && !hasMedia) {
    base.template.components = [{ type: 'body', parameters: attributesArr }]
  } else if (hasVariable && hasMedia) {
    const mediaObject = { link: mediaUrl }
    if (mediaType === 'document') {
      mediaObject.filename = mediaFilename.replace(/\.[^.]+$/, '') || 'Document'
    }
    base.template.components = [
      { type: 'header', parameters: [{ type: mediaType, [mediaType]: mediaObject }] },
      { type: 'body', parameters: attributesArr },
    ]
  } else if (hasMedia) {
    const mediaObject = { link: mediaUrl }
    if (mediaType === 'document') mediaObject.filename = mediaFilename || 'Document'
    base.template.components = [{ type: 'header', parameters: [{ type: mediaType, [mediaType]: mediaObject }] }, { type: 'body' }]
  } else {
    base.template.components = [{ type: 'body' }]
  }

  return base
}

/** 'M' (marketing) templates always bill as paid; 'U' (utility) only bills as paid once WhatsApp's 24h free-service window has closed (mappers.js's `isWindowExpired` — no prior reply at all also counts as expired, matching legacy's `strtotime('')` producing a huge diff). */
async function resolvePaidTemplateFlag({ template, whatsappNumber, waNumber }) {
  if (template.category === 'M') return 'P'
  if (template.category !== 'U') return 'F'

  const lastReply = await messagesModel.findLastInboundReply({ mobile: whatsappNumber, waNumber })
  return isWindowExpired(lastReply) ? 'P' : 'F'
}

/**
 * The actual send, shared by the automation trigger and the manual "Send Approved
 * Template" popup: resolve variables, build the vendor payload, send it, and (on
 * success) record the message/sent-log/template-count/wallet-deduction bookkeeping.
 * `manualValues` (keyed by the `template_variable_name` row's own `id`) supplies
 * user-typed text for 'other'-prefixed variables only — every other prefix always
 * resolves from live CRM data regardless of what's passed here, matching legacy.
 * `mediaOverride` (`{url, mediaType, filename}`) overrides the template's own
 * configured media for this one send, matching legacy's optional file upload.
 */
export async function sendApprovedTemplateToRecipient({ userAdminId, templateId, recipient, manualValues = {}, mediaOverride = null }) {
  const template = await manageWhstappTemplateModel.findById(templateId)
  if (!template || template.status !== 'Y' || template.templateVendor !== 'A') return { sent: false, reason: 'template_not_usable' }

  if (!recipient || recipient.stopService === 'Y') return { sent: false, reason: 'opted_out_or_missing' }

  const employee = await employeesModel.findEmployeeById(userAdminId)
  if (!employee || employee.whatsappVendor !== 'A') return { sent: false, reason: 'not_aisensy_vendor' }

  const variableRows = await templateVariableNameModel.findForTemplate(templateId)
  if (template.templateVariable > 0 && variableRows.length === 0) {
    return { sent: false, reason: 'variable_mappings_missing' }
  }

  const rawValues = []
  for (const variableRow of variableRows) {
    const [prefix, field] = (variableRow.secTypeFieldName || '').split('~')
    rawValues.push(await resolveVariableValue({ prefix, field, accountId: recipient.accountId, userAdminId, manualValue: manualValues[variableRow.id] }))
  }
  const attributeValues = rawValues.map((value) => (value === '' || value == null ? 'NA' : String(value)))

  let templateMsg = template.templateDescription
  attributeValues.forEach((value, index) => {
    templateMsg = templateMsg.replaceAll(`{{${index + 1}}}`, value)
  })

  const localNumber = String(recipient.countryCode) === '91' ? recipient.mobile.slice(-10) : recipient.mobile.replace(new RegExp(`^${recipient.countryCode}`), '')
  const whatsappNumber = `${recipient.countryCode}${localNumber}`

  const payload = buildAiSensyTemplatePayload({ template, whatsappNumber, attributeValues, accountId: recipient.accountId, mediaOverride })

  const freshEmployee = await refreshAiSensyTokenIfNeeded(employee)
  const response = await fetch('https://backend.aisensy.com/direct-apis/t1/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshEmployee.whatsappApiUsername}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const responseData = await response.json()
  const sourceMsgId = responseData?.messages?.[0]?.id || null

  await logModel.insertApiLog({
    userAdminId,
    templateId,
    apiUrlUse: 'whatsapp_automation_template',
    apiUrl: 'https://backend.aisensy.com/direct-apis/t1/messages',
    jsonData: payload,
    jsonResponse: responseData,
  })

  if (!sourceMsgId) return { sent: false, reason: 'vendor_send_failed', vendorResponse: responseData }

  const paidTemplate = await resolvePaidTemplateFlag({ template, whatsappNumber, waNumber: employee.whatsappWabano })
  const leadOwner = await leadsModel.findLeadByAccountId(recipient.accountId)
  const sendBy = leadOwner?.leadOwner > 0 ? leadOwner.leadOwner : userAdminId

  const inserted = await messagesModel.insertMessage({
    response: 'Template Sent From Agent',
    name: recipient.clientName,
    mobile: whatsappNumber,
    type: 'F',
    text: templateMsg,
    waNumber: employee.whatsappWabano,
    sendBy,
    userAdminId,
    accountId: recipient.accountId,
    leadId: recipient.leadId,
    sourceId: sourceMsgId,
    msgtype: 'S',
    status: 'Y',
    recvDate: new Date(),
    templateCatg: template.category,
    templateVendor: template.templateVendor,
    tid: String(templateId),
    vendorType: employee.whatsappVendor,
    countryCode: Number(recipient.countryCode) || 91,
    tempSta: 'Y',
    paidTemplate,
  })

  await whatsappSentFromClientModel.insertSentLog({
    userAdminId,
    accountId: recipient.accountId,
    leadId: recipient.leadId,
    templateCatg: template.category,
    templateVendor: template.templateVendor,
    msgId: sourceMsgId,
    sendTo: whatsappNumber,
    tid: String(templateId),
    oldTid: 0,
    sentOn: new Date(),
  })

  await accountModel.recordTemplateSent({ accountId: recipient.accountId, templateId })
  if (recipient.leadId > 0) await leadsModel.recordTemplateSent({ accountId: recipient.accountId, templateId })

  const permission = await crmWhatsappPermissionModel.findByClientId(userAdminId)
  if (permission && permission.customerType !== 'N') {
    const cost = await whatsappCountryWiseChargeModel.findCost({ countryCode: recipient.countryCode, forEmp: employee.waEmpMemType })
    const amount = template.category === 'U' ? (cost?.waUtilityAmt ?? 0) : (cost?.waMktgAmt ?? 0)
    await crmWhatsappPermissionModel.deductForSend({ clientId: userAdminId, category: template.category, amount, current: permission })
  }

  return { sent: true, sourceId: sourceMsgId, message: inserted }
}

/** Resolves a template-send recipient from an account, exactly the shape `sendApprovedTemplateToRecipient` expects. */
function recipientFromAccount(account, leadId = 0, clientNameOverride = null) {
  return {
    accountId: account.accountId,
    leadId,
    clientName: clientNameOverride || account.contactPersonName || account.accountName || account.phone,
    countryCode: account.ctryIsdCode || '91',
    mobile: account.phone,
    stopService: account.stopService,
  }
}

/**
 * Ports `send_automation_whatsapp_template()` (helper.php), scoped to this
 * integration's only two real call sites: a brand-new account (section_type=1) or
 * lead (section_type=2) just created by leadAutoCreation.js. NOT ported: the deal
 * branch (section_type=3, unreachable here), the bulk multi-recipient broadcast
 * loop (our call sites always create exactly one record), the "replica copy for
 * opposite WABA number" mirror-account send, and the `tbl_wallet`-based
 * auto-upgrade of `customer_type` to 'R' (wallet deduction still runs whenever
 * `customer_type` is already anything but the default 'N').
 */
export async function sendAutomationWhatsappTemplate({ userAdminId, sourceId, stageId, sectionType, accountId, leadId }) {
  const rule = await automationModel.findMatchingRule({ userAdminId, sectionType, sourceId, stageId })
  if (!rule) return { sent: false, reason: 'no_matching_rule' }

  let recipient
  if (sectionType === 1) {
    const account = await accountModel.findAccountById({ userAdminId, accountId })
    if (!account) return { sent: false, reason: 'opted_out_or_missing' }
    recipient = recipientFromAccount(account)
  } else if (sectionType === 2) {
    const lead = await leadsModel.findById(leadId)
    if (!lead) return { sent: false, reason: 'lead_not_found' }
    const account = await accountModel.findAccountById({ userAdminId, accountId: lead.accountId })
    if (!account) return { sent: false, reason: 'opted_out_or_missing' }
    recipient = recipientFromAccount(account, lead.leadId, lead.firstName)
  } else {
    return { sent: false, reason: 'unsupported_section_type' }
  }

  return sendApprovedTemplateToRecipient({ userAdminId, templateId: rule.templateId, recipient })
}

/**
 * Manual send from the "Send Approved Template" popup — the user picks the
 * template themselves (no automation rule involved) for the contact of an
 * already-open conversation. Resolves the recipient the same way the rest of this
 * app does (CRM account by phone, its lead if any); the CRM account's own
 * `stopService` still gates the send exactly like every other path here.
 */
export async function sendApprovedTemplateManually({ userAdminId, mobile, countryCode, templateId, manualValues, mediaOverride }) {
  const account = await accountModel.findAccountByPhone({ userAdminId, mobile, countryCode })
  const lead = account ? await leadsModel.findLeadByAccountId(account.accountId) : null

  const recipient = account
    ? recipientFromAccount(account, lead?.leadId || 0, lead?.firstName)
    : { accountId: 0, leadId: 0, clientName: mobile, countryCode: countryCode || '91', mobile, stopService: 'N' }

  return sendApprovedTemplateToRecipient({ userAdminId, templateId, recipient, manualValues, mediaOverride })
}

// Reasons that mean "nothing configured for this yet" — an expected, silent no-op.
const SKIP_REASONS = new Set(['no_matching_rule', 'opted_out_or_missing', 'unsupported_section_type', 'not_aisensy_vendor'])
// Reasons that reached real config but that config is broken — still a safe no-op,
// but worth a louder log since it likely means something needs fixing.
const MISCONFIGURED_REASONS = new Set(['template_not_usable', 'variable_mappings_missing', 'lead_not_found'])

/**
 * Entry point for "trigger on the customer's first message" — called once per
 * inbound message from webhooksController, independent of whether a CRM
 * account/lead already existed (an imported account can still be receiving its
 * first-ever message). Fires the matching automation rule (if any) exactly once
 * per conversation: `messagesModel.countInboundMessages` is checked AFTER the
 * current message is already inserted, so a count of exactly 1 means this row
 * *is* the first one — every later message for the same (waNumber, mobile) will
 * see a count > 1 and skip. Never throws: every outcome (triggered, skipped,
 * failed) is logged and returned, not raised, so a misconfigured automation rule
 * or a vendor-side rejection can never break receipt of the real inbound message.
 */
export async function triggerFirstMessageAutomation({ userAdminId, waNumber, mobile, ownership }) {
  const logContext = { userAdminId, waNumber, mobile, accountId: ownership.accountId, leadId: ownership.leadId }

  try {
    const inboundCount = await messagesModel.countInboundMessages({ userAdminId, waNumber, mobile })
    if (inboundCount !== 1) {
      logger.debug({ ...logContext, inboundCount }, 'first-message automation: skipped (not the first message)')
      return { sent: false, reason: 'not_first_message' }
    }

    const sectionType = ownership.leadId > 0 ? 2 : 1
    const result = await sendAutomationWhatsappTemplate({
      userAdminId,
      sourceId: ownership.sourceId,
      stageId: ownership.leadStageId || '',
      sectionType,
      accountId: ownership.accountId,
      leadId: ownership.leadId,
    })

    if (result.sent) {
      logger.info({ ...logContext, sourceId: result.sourceId }, 'first-message automation: triggered')
    } else if (result.reason === 'vendor_send_failed') {
      logger.warn({ ...logContext }, 'first-message automation: failed (vendor rejected the send)')
    } else if (MISCONFIGURED_REASONS.has(result.reason)) {
      logger.warn({ ...logContext, reason: result.reason }, 'first-message automation: skipped (likely misconfigured)')
    } else if (SKIP_REASONS.has(result.reason)) {
      logger.debug({ ...logContext, reason: result.reason }, 'first-message automation: skipped (nothing configured)')
    } else {
      logger.info({ ...logContext, reason: result.reason }, 'first-message automation: skipped')
    }

    return result
  } catch (error) {
    logger.error({ ...logContext, err: error }, 'first-message automation: failed (unexpected error)')
    return { sent: false, reason: 'unexpected_error' }
  }
}
