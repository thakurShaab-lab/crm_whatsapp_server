import { mysqlTable, int, varchar, tinyint, datetime } from 'drizzle-orm/mysql-core'

/** Maps `nc_journey_tracker` — one open row per (WABA, client) pair currently mid-journey; `track_log_status='0'` means still open/waiting. */
export const ncJourneyTracker = mysqlTable('nc_journey_tracker', {
  trackId: int('track_id').autoincrement().primaryKey(),
  clientId: int('client_id').notNull().default(0),
  trackMobileNo: varchar('track_mobile_no', { length: 255 }).notNull().default(''), // our own WABA number
  trackJourneyId: int('track_journey_id').notNull().default(0),
  trackFromMobileNo: varchar('track_from_mobile_no', { length: 255 }).notNull().default(''), // the client's mobile
  trackLogStatus: tinyint('track_log_status').notNull().default(0), // 0=open, 1=closed
  trackLogDatetime: datetime('track_log_datetime').notNull(),
  trackLogTimeout: int('track_log_timeout').notNull().default(86400),
})
