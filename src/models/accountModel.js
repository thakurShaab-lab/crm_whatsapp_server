import { and, eq, like, or } from 'drizzle-orm'
import { db } from '../config/db.js'
import { account } from '../schema/account.js'

/**
 * Resolves a WhatsApp contact's CRM account by phone, stripping the ISD/country-code
 * prefix the same way the legacy PHP did (India numbers are matched on the last 10
 * digits) so a stored `phone` with or without the country code still matches.
 */
export async function findAccountByPhone({ userAdminId, mobile, countryCode }) {
  const localNumber = countryCode === '91' || countryCode === 91 ? mobile.slice(-10) : mobile

  const [row] = await db
    .select()
    .from(account)
    .where(and(eq(account.userAdminId, userAdminId), like(account.phone, `%${localNumber}`)))
    .limit(1)

  return row || null
}

/**
 * Exact 3-variant phone match legacy uses to gate lead/account auto-creation (full
 * mobile, ISD-stripped local number, or the "NA "+local storage quirk) — stricter
 * than `findAccountByPhone`'s fuzzy LIKE match, since a false negative here would
 * wrongly create a duplicate account for an existing client.
 */
export async function findAccountByPhoneVariants({ userAdminId, mobile, lastTenMobile }) {
  const [row] = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.userAdminId, userAdminId),
        or(eq(account.phone, mobile), eq(account.phone, lastTenMobile), eq(account.phone, `NA ${lastTenMobile}`)),
      ),
    )
    .limit(1)
  return row || null
}

export async function insertAccount(values) {
  const result = await db.insert(account).values(values)
  return Array.isArray(result) ? result[0].insertId : result.insertId
}

/** Resolves an account directly by id — used when the caller already knows `account_id` (the legacy `refid` query param) instead of guessing from a phone number. */
export async function findAccountById({ userAdminId, accountId }) {
  const [row] = await db
    .select()
    .from(account)
    .where(and(eq(account.userAdminId, userAdminId), eq(account.accountId, accountId)))
    .limit(1)

  return row || null
}

/**
 * Sets/clears STOP-service opt-out, matched against the same three phone variants
 * the legacy webhook handler checks (full mobile, ISD-stripped local number, and a
 * legacy `"NA " + local number` storage quirk seen in real account data).
 */
export async function setStopService({ userAdminId, mobile, countryCode, stopService }) {
  const localNumber = countryCode === '91' || countryCode === 91 ? mobile.slice(-10) : mobile
  await db
    .update(account)
    .set({ stopService, stopServiceDate: new Date() })
    .where(
      and(
        eq(account.userAdminId, userAdminId),
        or(eq(account.phone, mobile), eq(account.phone, localNumber), eq(account.phone, `NA ${localNumber}`)),
      ),
    )
}

/** Bumps `wa_template_count`/`wa_template_sent_dt` and appends `templateId` to the comma-separated `sent_wa_template_id` list, if not already present — exactly the legacy bookkeeping after every template send. */
export async function recordTemplateSent({ accountId, templateId }) {
  const [row] = await db.select({ waTemplateCount: account.waTemplateCount, sentWaTemplateId: account.sentWaTemplateId }).from(account).where(eq(account.accountId, accountId)).limit(1)
  if (!row) return

  const existingIds = row.sentWaTemplateId ? row.sentWaTemplateId.split(',') : []
  const sentWaTemplateId = existingIds.includes(String(templateId)) ? row.sentWaTemplateId : [...existingIds, templateId].filter(Boolean).join(',')

  await db
    .update(account)
    .set({ waTemplateCount: (row.waTemplateCount || 0) + 1, waTemplateSentDt: new Date(), sentWaTemplateId })
    .where(eq(account.accountId, accountId))
}

/** For "start a new chat": look up existing CRM accounts by name or phone. */
export async function searchAccounts({ userAdminId, search, limit = 20 }) {
  const conditions = [eq(account.userAdminId, userAdminId)]
  if (search) {
    conditions.push(or(like(account.accountName, `%${search}%`), like(account.contactPersonName, `%${search}%`), like(account.phone, `%${search}%`)))
  }

  return db.select().from(account).where(and(...conditions)).limit(limit)
}
