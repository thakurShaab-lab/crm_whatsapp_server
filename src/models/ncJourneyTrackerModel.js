import { and, desc, eq } from 'drizzle-orm'
import { db } from '../config/db.js'
import { ncJourneyTracker } from '../schema/ncJourneyTracker.js'

/** The most recent still-open tracker for this (WABA, client) pair, if the client is mid-journey. */
export async function findActiveTracker({ wabaNumber, clientMobile }) {
  const [row] = await db
    .select()
    .from(ncJourneyTracker)
    .where(and(eq(ncJourneyTracker.trackMobileNo, wabaNumber), eq(ncJourneyTracker.trackFromMobileNo, clientMobile), eq(ncJourneyTracker.trackLogStatus, 0)))
    .orderBy(desc(ncJourneyTracker.trackId))
    .limit(1)
  return row || null
}

export async function insertTracker({ clientId, wabaNumber, journeyId, clientMobile }) {
  const result = await db.insert(ncJourneyTracker).values({
    clientId,
    trackMobileNo: wabaNumber,
    trackJourneyId: journeyId,
    trackFromMobileNo: clientMobile,
    trackLogStatus: 0,
    trackLogDatetime: new Date(),
  })
  return Array.isArray(result) ? result[0].insertId : result.insertId
}

/** Every tracker id for this (WABA, client) pair — used to also clean up their `nc_journey_track_log` rows before the trackers themselves are removed on a hard delete. */
export async function findTrackIdsForMobile({ wabaNumber, clientMobile }) {
  const rows = await db
    .select({ trackId: ncJourneyTracker.trackId })
    .from(ncJourneyTracker)
    .where(and(eq(ncJourneyTracker.trackMobileNo, wabaNumber), eq(ncJourneyTracker.trackFromMobileNo, clientMobile)))
  return rows.map((row) => row.trackId)
}

/** Permanently removes every journey tracker for this (WABA, client) pair — used when hard-deleting a conversation. Call `ncJourneyTrackLogModel.deleteByTrackIds` (with `findTrackIdsForMobile`'s result) first, so no orphaned log rows are left behind. */
export async function deleteByMobile({ wabaNumber, clientMobile }) {
  await db.delete(ncJourneyTracker).where(and(eq(ncJourneyTracker.trackMobileNo, wabaNumber), eq(ncJourneyTracker.trackFromMobileNo, clientMobile)))
}
