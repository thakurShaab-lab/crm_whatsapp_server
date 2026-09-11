import { handleIncomingWebhook } from './webhooksController.js'
import * as responseModel from '../models/responseModel.js'

/**
 * Dev-only helper standing in for a real vendor callback. Funnels through the exact
 * same `handleIncomingWebhook` path as the real webhook route, so this is the
 * supported way to move a stubbed message through sent -> delivered -> read (or
 * -> failed), or inject an inbound message, without ever using a timer.
 *
 * Also stages this payload through `whatsapp_response` exactly like the real
 * AiSensy webhook route does (see webhooksController.js's receiveAiSensyWebhook) —
 * since no real vendor callback can reach a local dev server, this is the only
 * path that ever exercises that table outside production.
 */
export async function simulateWebhook(req, res) {
  const rawResponseId = await responseModel.insertRawResponse({ response: req.body })
  try {
    const result = await handleIncomingWebhook({
      userAdminId: req.userAdminId,
      waNumber: req.waNumber,
      payload: req.body,
    })
    res.status(200).json({ ok: true, result })
  } finally {
    await responseModel.markProcessed(rawResponseId).catch(() => {})
  }
}
