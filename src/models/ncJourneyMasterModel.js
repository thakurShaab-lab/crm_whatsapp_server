import { and, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/mysql-core'
import { db } from '../config/db.js'
import { ncJourneyMaster } from '../schema/ncJourneyMaster.js'

/**
 * Exactly the legacy self-join (whatsapp_aisense_response.php ~line 497): `m` is a
 * root journey (journey_refer_id=0) configured for this WABA number; `p` is one of
 * its trigger-phrase child rows. Returns the root journey (`m.*`) if any trigger
 * phrase matches the received text.
 */
export async function findTriggerMatch({ wabaNumber, triggerMessage }) {
  const triggerRow = alias(ncJourneyMaster, 'p')

  const [row] = await db
    .select({ journeyId: ncJourneyMaster.journeyId })
    .from(ncJourneyMaster)
    .innerJoin(triggerRow, and(eq(ncJourneyMaster.journeyId, triggerRow.journeyReferId), eq(triggerRow.journeyTriggerMessage, triggerMessage)))
    .where(and(eq(ncJourneyMaster.journeyMobileNo, wabaNumber), eq(ncJourneyMaster.journeyReferId, 0), eq(ncJourneyMaster.journeyStatus, 1)))
    .limit(1)

  return row || null
}
