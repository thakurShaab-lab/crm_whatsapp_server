import { db } from '../config/db.js'
import { whatsappToken } from '../schema/whatsappToken.js'

/** Audit row for one AiSensy token regeneration — legacy's `update_whatsapp_token()` (helper.php) insert into `whatsapp_token`, alongside its update of `tbl_employees`'s own token columns. */
export async function insertTokenLog({ empId, token }) {
  await db.insert(whatsappToken).values({ empId, tokenNo: token, recvDate: new Date() })
}
