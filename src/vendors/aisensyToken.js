import { updateWhatsappToken } from '../models/employeesModel.js'

const REGENERATE_TOKEN_URL = 'https://backend.aisensy.com/direct-apis/t1/users/regenrate-token'
const UPDATE_WEBHOOK_URL = 'https://backend.aisensy.com/direct-apis/t1/settings/update-webhook'

/** Decodes a JWT's payload segment without verifying the signature — only used to read the `iat` claim. */
function decodeJwtPayload(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  try {
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Exact port of legacy `update_whatsapp_token()` from helper.php: regenerates the
 * AiSensy WABA token from the stored username/password/app id, and persists it back
 * onto `tbl_employees`. Legacy also inserts an audit row into a `whatsapp_token`
 * table — that table is outside this project's agreed schema scope (only the 5
 * originally-specified tables), so that insert is intentionally not replicated here;
 * the functional part (the employee row's own token/expiry) is still updated.
 */
export async function refreshAiSensyToken(employee) {
  const credentials = `${employee.waLoginUsername}:${employee.whatsappApiPassword}:${employee.whatsappAppId}`
  const basicToken = Buffer.from(credentials).toString('base64')

  const response = await fetch(REGENERATE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${basicToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ direct_api: true }),
  })

  const data = await response.json()
  const token = data?.users?.[0]?.token
  if (!token) {
    throw new Error(`AiSensy token regeneration failed: ${JSON.stringify(data)}`)
  }

  // Legacy mislabels the JWT's `iat` (issued-at) claim as the expiry — replicated
  // as-is for behavioral fidelity with the real system rather than "fixed" here.
  const payload = decodeJwtPayload(token)
  const tokenExpiresAt = payload?.iat ? new Date(payload.iat * 1000) : null

  await updateWhatsappToken({ empId: employee.empId, token, tokenExpiresAt })

  return { token, tokenExpiresAt }
}

/** Refreshes the token only when the currently stored one has actually expired. */
export async function refreshAiSensyTokenIfNeeded(employee) {
  const expiresAt = employee.waTokenExpDt ? new Date(employee.waTokenExpDt) : null
  if (expiresAt && expiresAt.getTime() >= Date.now()) {
    return employee
  }

  const { token, tokenExpiresAt } = await refreshAiSensyToken(employee)
  return { ...employee, whatsappApiUsername: token, waTokenExpDt: tokenExpiresAt }
}

/**
 * Points this WABA number's webhook subscription at a URL, via AiSensy's Direct API
 * (`PATCH .../settings/update-webhook`, body `{ webhooks: { url } }`). Always forces
 * a fresh token first rather than trusting the stored one's (unreliable — see the
 * `iat`-as-expiry note above) expiry check, since a stale token is the most likely
 * cause of this endpoint's "Invalid Token!" error.
 */
export async function updateAiSensyWebhook(employee, webhookUrl) {
  const { token } = await refreshAiSensyToken(employee)

  const response = await fetch(UPDATE_WEBHOOK_URL, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhooks: { url: webhookUrl } }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`AiSensy update-webhook failed (${response.status}): ${JSON.stringify(data)}`)
  }
  return data
}