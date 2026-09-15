import { eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { crmWhatsappPermission } from '../schema/crmWhatsappPermission.js'

export async function findByClientId(clientId) {
  const [row] = await db.select().from(crmWhatsappPermission).where(eq(crmWhatsappPermission.clientId, clientId)).limit(1)
  return row || null
}

/**
 * Deducts one template's cost and bumps the sent counters — only ever called when
 * `customer_type != 'N'` (billing not yet activated for most employees). `customerType`
 * (pass 'R' once walletModel.hasPaidRecharge finds a genuine recharge) mirrors
 * legacy's conditional `$cstypestr` append (helper.php ~line 817/836) — omitted, this
 * leaves `customer_type` untouched exactly like legacy's empty `$cstypestr`.
 */
export async function deductForSend({ clientId, category, amount, current, customerType }) {
  const newUtlityMsg = category === 'U' ? current.utlityMsg + 1 : current.utlityMsg
  const newMktgMsg = category === 'M' ? current.mktgMsg + 1 : current.mktgMsg
  const newBalance = current.balWalletAmt - amount

  await db
    .update(crmWhatsappPermission)
    .set({
      totalWpSent: newUtlityMsg + newMktgMsg,
      utlityMsg: newUtlityMsg,
      mktgMsg: newMktgMsg,
      balWalletAmt: newBalance,
      ...(customerType ? { customerType } : {}),
    })
    .where(eq(crmWhatsappPermission.clientId, clientId))
}
