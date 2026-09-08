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
async function resolveVariableValue({ prefix, field, accountId, userAdminId }) {
  if (!field) return ''

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

  if (prefix === 'other') return ''
  if (prefix === 'extra') return 'NA'
  return ''
}

/** Exactly `func_whatsapp_send_aisense_api()`'s payload branching (button-url / variable+media / variable-only / media-only / plain). */
function buildAiSensyTemplatePayload({ template, whatsappNumber, attributeValues, accountId }) {
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
  const hasMedia = Boolean(template.vendorMediaUrl)

  if (hasVariable && !hasMedia) {
    base.template.components = [{ type: 'body', parameters: attributesArr }]
  } else if (hasVariable && hasMedia) {
    const mediaObject = { link: template.vendorMediaUrl }
    if (template.mediaType === 'document') {
      mediaObject.filename = template.mediaFilename.replace(/\.[^.]+$/, '') || 'Document'
    }
    base.template.components = [
      { type: 'header', parameters: [{ type: template.mediaType, [template.mediaType]: mediaObject }] },
      { type: 'body', parameters: attributesArr },
    ]
  } else if (hasMedia) {
    const mediaObject = { link: template.vendorMediaUrl }
    if (template.mediaType === 'document') mediaObject.filename = template.mediaFilename || 'Document'
    base.template.components = [{ type: 'header', parameters: [{ type: template.mediaType, [template.mediaType]: mediaObject }] }, { type: 'body' }]
  } else {
    base.template.components = [{ type: 'body' }]
  }

  return base
}

/** 'M' (marketing) templates always bill as paid; 'U' (utility) only bills as paid once WhatsApp's 24h free-service window (since the client's last real reply) has elapsed — no prior reply at all also counts as elapsed, matching legacy's `strtotime('')` producing a huge diff. */
async function resolvePaidTemplateFlag({ template, whatsappNumber, waNumber }) {
  if (template.category === 'M') return 'P'
  if (template.category !== 'U') return 'F'

  const lastReply = await messagesModel.findLastInboundReply({ mobile: whatsappNumber, waNumber })
  if (!lastReply) return 'P'

  const diffHours = (Date.now() - new Date(lastReply.recvDate).getTime()) / 3_600_000
  return diffHours > 24 ? 'P' : 'F'
}

/**
 * Ports `send_automation_whatsapp_template()` (helper.php), scoped to this
 * integration's only two real call sites: a brand-new account (section_type=1) or
 * lead (section_type=2) just created by leadAutoCreation.js. NOT ported: the deal
 * branch (section_type=3, unreachable here), the bulk multi-recipient broadcast
 * loop (our call sites always create exactly one record), the "replica copy for
 * opposite WABA number" mirror-account send, and the `tbl_wallet`-based
 * auto-upgrade of `customer_type` to 'R' (wallet deduction below still runs
 * whenever `customer_type` is already anything but the default 'N').
 */
export async function sendAutomationWhatsappTemplate({ userAdminId, sourceId, stageId, sectionType, accountId, leadId }) {
  const rule = await automationModel.findMatchingRule({ userAdminId, sectionType, sourceId, stageId })
  if (!rule) return { sent: false, reason: 'no_matching_rule' }

  const template = await manageWhstappTemplateModel.findById(rule.templateId)
  if (!template || template.status !== 'Y' || template.templateVendor !== 'A') return { sent: false, reason: 'template_not_usable' }

  let recipient
  if (sectionType === 1) {
    const account = await accountModel.findAccountById({ userAdminId, accountId })
    if (!account || account.stopService === 'Y') return { sent: false, reason: 'opted_out_or_missing' }
    recipient = { accountId: account.accountId, leadId: 0, clientName: account.accountName, countryCode: account.ctryIsdCode || '91', mobile: account.phone }
  } else if (sectionType === 2) {
    const lead = await leadsModel.findById(leadId)
    if (!lead) return { sent: false, reason: 'lead_not_found' }
    const account = await accountModel.findAccountById({ userAdminId, accountId: lead.accountId })
    if (!account || account.stopService === 'Y') return { sent: false, reason: 'opted_out_or_missing' }
    recipient = { accountId: lead.accountId, leadId: lead.leadId, clientName: lead.firstName, countryCode: lead.ctryIsdCode || '91', mobile: lead.mobile }
  } else {
    return { sent: false, reason: 'unsupported_section_type' }
  }

  const employee = await employeesModel.findEmployeeById(userAdminId)
  if (!employee || employee.whatsappVendor !== 'A') return { sent: false, reason: 'not_aisensy_vendor' }

  const variableRows = await templateVariableNameModel.findForTemplate(rule.templateId)
  const rawValues = []
  for (const variableRow of variableRows) {
    const [prefix, field] = (variableRow.secTypeFieldName || '').split('~')
    rawValues.push(await resolveVariableValue({ prefix, field, accountId: recipient.accountId, userAdminId }))
  }
  const attributeValues = rawValues.map((value) => (value === '' || value == null ? 'NA' : String(value)))

  let templateMsg = template.templateDescription
  attributeValues.forEach((value, index) => {
    templateMsg = templateMsg.replaceAll(`{{${index + 1}}}`, value)
  })

  const localNumber = String(recipient.countryCode) === '91' ? recipient.mobile.slice(-10) : recipient.mobile.replace(new RegExp(`^${recipient.countryCode}`), '')
  const whatsappNumber = `${recipient.countryCode}${localNumber}`

  const payload = buildAiSensyTemplatePayload({ template, whatsappNumber, attributeValues, accountId: recipient.accountId })

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
    templateId: rule.templateId,
    apiUrlUse: 'whatsapp_automation_template',
    apiUrl: 'https://backend.aisensy.com/direct-apis/t1/messages',
    jsonData: payload,
    jsonResponse: responseData,
  })

  if (!sourceMsgId) return { sent: false, reason: 'vendor_send_failed' }

  const paidTemplate = await resolvePaidTemplateFlag({ template, whatsappNumber, waNumber: employee.whatsappWabano })
  const leadOwner = await leadsModel.findLeadByAccountId(recipient.accountId)
  const sendBy = leadOwner?.leadOwner > 0 ? leadOwner.leadOwner : userAdminId

  await messagesModel.insertMessage({
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
    tid: String(rule.templateId),
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
    tid: String(rule.templateId),
    oldTid: 0,
    sentOn: new Date(),
  })

  await accountModel.recordTemplateSent({ accountId: recipient.accountId, templateId: rule.templateId })
  if (recipient.leadId > 0) await leadsModel.recordTemplateSent({ accountId: recipient.accountId, templateId: rule.templateId })

  const permission = await crmWhatsappPermissionModel.findByClientId(userAdminId)
  if (permission && permission.customerType !== 'N') {
    const cost = await whatsappCountryWiseChargeModel.findCost({ countryCode: recipient.countryCode, forEmp: employee.waEmpMemType })
    const amount = template.category === 'U' ? (cost?.waUtilityAmt ?? 0) : (cost?.waMktgAmt ?? 0)
    await crmWhatsappPermissionModel.deductForSend({ clientId: userAdminId, category: template.category, amount, current: permission })
  }

  return { sent: true, sourceId: sourceMsgId }
}
