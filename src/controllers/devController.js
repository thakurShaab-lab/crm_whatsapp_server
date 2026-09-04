import { handleIncomingWebhook } from './webhooksController.js'

/**
 * Dev-only helper standing in for a real vendor callback. Funnels through the exact
 * same `handleIncomingWebhook` path as the real webhook route, so this is the
 * supported way to move a stubbed message through sent -> delivered -> read (or
 * -> failed), or inject an inbound message, without ever using a timer.
 */
export async function simulateWebhook(req, res) {
  const result = await handleIncomingWebhook({
    userAdminId: req.userAdminId,
    waNumber: req.waNumber,
    payload: req.body,
  })
  res.status(200).json({ ok: true, result })
}
