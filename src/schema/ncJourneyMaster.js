import { mysqlTable, int, varchar, tinyint, datetime } from 'drizzle-orm/mysql-core'

/**
 * Maps `nc_journey_master` — a journey is one "root" row (journey_refer_id=0,
 * identified by the WABA number it's configured for) plus one or more "trigger"
 * child rows (journey_refer_id = the root's journey_id) each carrying one phrase
 * that starts it — see journeyEngine.js's `findTriggerMatch`.
 */
export const ncJourneyMaster = mysqlTable('nc_journey_master', {
  journeyId: int('journey_id').autoincrement().primaryKey(),
  clientId: int('client_id').notNull().default(0),
  journeyTitle: varchar('journey_title', { length: 255 }).notNull().default(''),
  journeyTriggerMessage: varchar('journey_trigger_message', { length: 255 }).notNull().default(''),
  journeyTriggerMatchtype: int('journey_trigger_matchtype').notNull().default(0), // 0=exact, 1=contains
  journeyMobileNo: varchar('journey_mobile_no', { length: 255 }).notNull().default(''),
  journeyReferId: int('journey_refer_id').notNull().default(0),
  // The DB comment says 0=active/1=non-active, but the legacy trigger-match query
  // literally filters journey_status=1 — kept as-is (faithful port), not "fixed"
  // against a comment that may just be stale.
  journeyStatus: tinyint('journey_status').notNull().default(0),
  journeyDatetime: datetime('journey_datetime').notNull(),
  journeyAddedBy: int('journey_added_by').notNull().default(0),
})
