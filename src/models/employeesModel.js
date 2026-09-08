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
