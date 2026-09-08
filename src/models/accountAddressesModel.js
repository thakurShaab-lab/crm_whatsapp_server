import { db } from '../config/db.js'
import { accountAddresses } from '../schema/accountAddresses.js'

/** Placeholder billing/shipping-address row — legacy inserts one alongside every new account, addressed later manually if ever needed. */
export async function insertPlaceholderAddress(accountId) {
  await db.insert(accountAddresses).values({ accountId })
}
