import * as manageWhstappTemplateModel from '../models/manageWhstappTemplateModel.js'
import * as templateVariableNameModel from '../models/templateVariableNameModel.js'
import { sendApprovedTemplateManually } from '../services/templateAutomation.js'
import { storeUploadedFiles } from '../utils/mediaStorage.js'
import { requirePublicMediaUrl } from '../vendors/vendorAdapter.js'
import { toMessageDto } from '../utils/mappers.js'
import { HttpError } from '../middleware/errorHandler.js'
import { emitNewMessage } from '../socket/emitters.js'
import { buildConversationSummaryDto } from './conversationsController.js'

const LEGACY_TYPE_TO_AISENSY_MEDIA_TYPE = { I: 'image', V: 'video', A: 'audio', D: 'document' }

const SEND_FAILURE_MESSAGE = {
  template_not_usable: 'This template is no longer approved for sending.',
  opted_out_or_missing: 'This contact has opted out (STOP) and cannot be messaged.',
  variable_mappings_missing: 'This template is missing its variable configuration — contact your admin.',
  not_aisensy_vendor: "This employee's WhatsApp account is not configured for template sending.",
  vendor_send_failed: 'WhatsApp rejected this template — it may not be approved yet, or its content may not match what was submitted for approval.',
}

function toTemplateSummaryDto(template) {
  return {
    id: template.id,
    title: template.templateTitle,
    category: template.category, // M=Marketing, U=Utility
    language: template.templateLanguage,
    mediaType: template.mediaType,
    hasButtonUrl: Boolean(template.templateButtonUrl),
    variableCount: template.templateVariable,
    description: template.templateDescription,
  }
}

/**
 * Mirrors ajax_response.php's `get_label_by_whatsapp_template` truncation: the
 * template's own attached filename shown next to "is attached" is cut to 20 chars
 * (dropping the extension) when the name itself is long, otherwise shown in full
 * with its extension.
 */
function shortenMediaFilename(filename) {
  if (!filename) return null
  const dot = filename.lastIndexOf('.')
  const name = dot >= 0 ? filename.slice(0, dot) : filename
  const ext = dot >= 0 ? filename.slice(dot + 1) : ''
  if (name.length > 20) return `${name.slice(0, 20)}...`
  return ext ? `${name}.${ext}` : name
}

/**
 * Only these three `sec_type_field_name` values ever get a real, user-editable
 * input in the legacy popup — every other variable (whatever its prefix) is always
 * auto-resolved from CRM data and rendered readonly with an "Auto Fetch"
 * placeholder. See ajax_response.php's `get_label_by_whatsapp_template`.
 */
const VARIABLE_KIND_BY_FIELD_NAME = {
  'other~other_text': 'text',
  'other~other_time': 'time',
  'other~other_date': 'date',
}

function toVariableDto(row) {
  const kind = VARIABLE_KIND_BY_FIELD_NAME[row.secTypeFieldName] || 'readonly'
  return {
    id: row.id,
    vid: row.vid,
    label: row.variableName,
    editable: kind !== 'readonly',
    inputType: kind === 'date' ? 'date' : 'text',
    placeholder: kind === 'text' ? row.variableName : kind === 'time' ? 'HH:MM' : 'Auto Fetch',
  }
}

/** GET /api/templates — every approved template this employee can pick from in the "Send Approved Template" popup. */
export async function listTemplates(req, res) {
  const templates = await manageWhstappTemplateModel.findApprovedForEmployee(req.userAdminId)
  res.json({ items: templates.map(toTemplateSummaryDto) })
}

/**
 * GET /api/templates/:id — one template's full detail plus its `{{N}}` placeholder
 * list, each annotated with whether it needs a manually-typed value (only
 * 'other~other_text'/'other~other_time'/'other~other_date' do) or is always
 * auto-resolved from CRM data on send — the popup renders every variable as a
 * field, but only the editable ones accept typing (see toVariableDto above).
 * Also carries the media box's own state: whether this template has media at
 * all, its own already-configured file (if any), and whether it's an
 * invoice-attachment template (which shows a read-only "Auto Fetch" field
 * instead of an upload box, exactly like legacy).
 */
export async function getTemplateDetail(req, res) {
  const templateId = Number(req.params.id)
  const template = await manageWhstappTemplateModel.findById(templateId)
  if (!template || template.clientId !== req.userAdminId) {
    throw new HttpError(404, 'Template not found')
  }

  const variableRows = await templateVariableNameModel.findForTemplate(templateId)
  const variables = variableRows.map(toVariableDto)

  res.json({
    ...toTemplateSummaryDto(template),
    variables,
    isInvoiceTemplate: template.invoiceTemplate === 'Y',
    mediaFilename: template.mediaFilename || null,
    mediaFilenameShort: shortenMediaFilename(template.mediaFilename),
    vendorMediaUrl: template.vendorMediaUrl || null,
  })
}

/**
 * POST /api/conversations/:mobile/messages/template — manual send from the "Send
 * Approved Template" popup. `manualValues` is a JSON string (multipart form fields
 * are always strings) mapping a variable row's own `id` to the text a person typed
 * for it; only 'other'-prefixed variables ever use this. `file` optionally
 * overrides the template's own configured media for this one send.
 */
export async function sendTemplateToConversation(req, res) {
  const { mobile } = req.params
  const templateId = Number(req.body.templateId)
  if (!templateId) throw new HttpError(400, 'templateId is required')

  let manualValues = {}
  if (req.body.manualValues) {
    try {
      manualValues = JSON.parse(req.body.manualValues)
    } catch {
      throw new HttpError(400, 'manualValues must be valid JSON')
    }
  }

  let mediaOverride = null
  if (req.file) {
    const [stored] = await storeUploadedFiles(req.userAdminId, [req.file])
    mediaOverride = {
      url: requirePublicMediaUrl(stored.url),
      mediaType: LEGACY_TYPE_TO_AISENSY_MEDIA_TYPE[stored.type] || 'document',
      filename: stored.originalFilename,
    }
  }

  const result = await sendApprovedTemplateManually({
    userAdminId: req.userAdminId,
    mobile,
    countryCode: req.query.ctrId || '91',
    templateId,
    manualValues,
    mediaOverride,
  })

  if (!result.sent) {
    const status = result.reason === 'opted_out_or_missing' ? 409 : 422
    throw new HttpError(status, SEND_FAILURE_MESSAGE[result.reason] || 'The template could not be sent. Please try again.')
  }

  const dto = toMessageDto(result.message)
  const conversation = await buildConversationSummaryDto({ userAdminId: req.userAdminId, waNumber: req.waNumber, mobile: result.message.mobile })
  emitNewMessage(req.waNumber, { mobile: result.message.mobile, message: dto, conversation })

  res.json({ ok: true, message: dto })
}
