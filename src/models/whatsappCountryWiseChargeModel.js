import { and, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { whatsappCountryWiseCharge } from '../schema/whatsappCountryWiseCharge.js'

/** The configured cost for this country+employee-tier, falling back to the generic '0' country row legacy uses when no exact match exists. */
export async function findCost({ countryCode, forEmp }) {
  const [exact] = await db
    .select()
    .from(whatsappCountryWiseCharge)
    .where(and(eq(whatsappCountryWiseCharge.countryCode, Number(countryCode)), eq(whatsappCountryWiseCharge.forEmp, forEmp)))
    .limit(1)
  if (exact) return exact

  const [fallback] = await db
    .select()
    .from(whatsappCountryWiseCharge)
    .where(and(eq(whatsappCountryWiseCharge.countryCode, 0), eq(whatsappCountryWiseCharge.forEmp, forEmp)))
    .limit(1)
  return fallback || null
}
