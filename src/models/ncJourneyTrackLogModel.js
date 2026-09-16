import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../config/db.js'
import { ncJourneyTrackLog } from '../schema/ncJourneyTrackLog.js'

/** The most recently visited node for a tracker — "where the client currently is" in the journey. */
export async function findLastLog(trackId) {
  const [row] = await db.select().from(ncJourneyTrackLog).where(eq(ncJourneyTrackLog.logTrackId, trackId)).orderBy(desc(ncJourneyTrackLog.logId)).limit(1)
  return row || null
}

export async function insertLog({ trackId, nodeId }) {
  await db.insert(ncJourneyTrackLog).values({ logTrackId: trackId, logNodeId: nodeId, logDatetime: new Date() })
}

/** Permanently removes every node-visit log for the given tracker ids — used when hard-deleting a conversation, ahead of removing the trackers themselves (see ncJourneyTrackerModel.findTrackIdsForMobile). */
export async function deleteByTrackIds(trackIds) {
  const ids = [...new Set(trackIds.filter(Boolean))]
  if (ids.length === 0) return
  await db.delete(ncJourneyTrackLog).where(inArray(ncJourneyTrackLog.logTrackId, ids))
}
