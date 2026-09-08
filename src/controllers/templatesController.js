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

/** GET /api/templates — every approved template this employee can pick from in the "Send Approved Template" popup. */
export async function listTemplates(req, res) {
  const templates = await manageWhstappTemplateModel.findApprovedForEmployee(req.userAdminId)
  res.json({ items: templates.map(toTemplateSummaryDto) })
}

/**
 * GET /api/templates/:id — one template's full detail plus its `{{N}}` placeholder
 * list, each annotated with whether it needs a manually-typed value ('other'
 * prefix) or is always auto-resolved from CRM data on send (every other prefix) —
 * the popup only ever renders an input for the former.
 */
export async function getTemplateDetail(req, res) {
  const templateId = Number(req.params.id)
  const template = await manageWhstappTemplateModel.findById(templateId)
  if (!template || template.clientId !== req.userAdminId) {
    throw new HttpError(404, 'Template not found')
  }

  const variableRows = await templateVariableNameModel.findForTemplate(templateId)
  const variables = variableRows.map((row) => {
    const [prefix] = (row.secTypeFieldName || '').split('~')
    return { id: row.id, vid: row.vid, label: row.variableName, editable: prefix === 'other' }
  })

  res.json({ ...toTemplateSummaryDto(template), variables })
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
