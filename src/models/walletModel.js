import { and, eq, gt } from 'drizzle-orm'
import { db } from '../config/db.js'
import { wallet } from '../schema/wallet.js'

/**
 * Whether this tenant has ever made a genuine paid recharge (`wallet_type='R'`,
 * `transaction_amount>0`) — legacy's gate (helper.php ~line 815, duplicated in
 * send_whatsapp_pop_other.php) for auto-upgrading `tbl_employees.wa_member_type`
 * and `crm_whatsapp_permission.customer_type` from the default tier to 'R' (Recharge).
 */
export async function hasPaidRecharge(userAdminId) {
  const [row] = await db
    .select({ id: wallet.id })
    .from(wallet)
    .where(and(eq(wallet.userAdminId, userAdminId), eq(wallet.walletType, 'R'), gt(wallet.transactionAmount, 0)))
    .limit(1)
  return Boolean(row)
}
