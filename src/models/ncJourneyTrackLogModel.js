import { desc, eq } from 'drizzle-orm'
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
