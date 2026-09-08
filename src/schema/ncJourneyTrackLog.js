import { mysqlTable, int, datetime } from 'drizzle-orm/mysql-core'

/** Maps `nc_journey_track_log` — one row per node visited by a tracker; the most recent row for a track_id is "where the client currently is" in the journey. */
export const ncJourneyTrackLog = mysqlTable('nc_journey_track_log', {
  logId: int('log_id').autoincrement().primaryKey(),
  logTrackId: int('log_track_id').notNull().default(0),
  logNodeId: int('log_node_id').notNull().default(0),
  logDatetime: datetime('log_datetime').notNull(),
})
