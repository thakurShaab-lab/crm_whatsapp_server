import { and, eq, or } from 'drizzle-orm'
import { db } from '../config/db.js'
import { employees } from '../schema/employees.js'

export async function findEmployeeById(empId) {
  const [row] = await db.select().from(employees).where(eq(employees.empId, empId)).limit(1)
  return row || null
}

/**
 * Resolves the employee/business a WABA number belongs to — used both by the
 * "replica copy for opposite WABA number" send-time lookup and by the real inbound
 * webhook (which only tells us the receiving `display_phone_number`, exactly like
 * legacy's `whatsapp_wabano='...' AND user_type='1'` lookup in whatsapp_aisense_response.php).
 */
export async function findEmployeeByWabaNo(wabaNo) {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.whatsappWabano, wabaNo), eq(employees.userType, '1')))
    .limit(1)
  return row || null
}

/**
 * All configured employees' own personal phone numbers, as last-10-digit suffixes
 * (the column is stored without a country-code prefix, while conversation mobiles vary
 * in whether they carry one). A conversation whose mobile matches one of these is an
 * internal test/support contact — the employee messaging their own WABA — not a real
 * client, so no name derived from it (CRM lead data, WhatsApp profile name) is a
 * trustworthy client identity.
 */
export async function getEmployeePhoneSuffixes() {
  const rows = await db.select({ phoneNumber: employees.phoneNumber }).from(employees)
  return new Set(rows.filter((row) => row.phoneNumber).map((row) => row.phoneNumber.slice(-10)))
}

export function isEmployeeMobile(mobile, phoneSuffixes) {
  return phoneSuffixes.has(String(mobile).slice(-10))
}

/** Persists a refreshed AiSensy token, exactly matching legacy's WHERE clause (self or anyone this employee created). */
export async function updateWhatsappToken({ empId, token, tokenExpiresAt }) {
  await db
    .update(employees)
    .set({
      whatsappApiUsername: token,
      waApiKeyDt: new Date(),
      ...(tokenExpiresAt ? { waTokenExpDt: tokenExpiresAt } : {}),
    })
    .where(
      and(
        or(eq(employees.empId, empId), eq(employees.createdBy, empId)),
        eq(employees.whatsappPermission, 'Y'),
        eq(employees.whatsappVendor, 'A'),
      ),
    )
}
