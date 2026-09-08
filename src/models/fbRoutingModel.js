import { and, eq, ne } from 'drizzle-orm'
import { db } from '../config/db.js'
import { fbinqForwarding } from '../schema/fbinqForwarding.js'

/**
 * Exactly the legacy round-robin lead-distribution logic (whatsapp_aisense_response.php
 * ~lines 434-492): if any sub-employee is configured to receive leads for this source
 * (`lead_shift_status='N'`, excluding the admin's own row), pick whoever's `shift_status`
 * is still 'N' (hasn't had a turn yet this cycle) — resetting everyone back to 'N' first
 * if the whole rotation has already gone through a cycle — then mark that pick 'Y' so
 * the next lead skips them. If no rotation is configured at all, the admin owns it.
 */
export async function resolveRoundRobinOwner({ userAdminId, sourceId }) {
  const [rotationConfigured] = await db
    .select({ slno: fbinqForwarding.slno })
    .from(fbinqForwarding)
    .where(
      and(
        eq(fbinqForwarding.userAdminId, userAdminId),
        ne(fbinqForwarding.empId, userAdminId),
        eq(fbinqForwarding.status, 'Y'),
        eq(fbinqForwarding.leadShiftStatus, 'N'),
        eq(fbinqForwarding.forSourceId, String(sourceId)),
      ),
    )
    .limit(1)

  if (!rotationConfigured) return userAdminId

  const nextUpCondition = and(
    eq(fbinqForwarding.shiftStatus, 'N'),
    eq(fbinqForwarding.status, 'Y'),
    eq(fbinqForwarding.userAdminId, userAdminId),
    eq(fbinqForwarding.forSourceId, String(sourceId)),
  )

  let [nextUp] = await db.select().from(fbinqForwarding).where(nextUpCondition).limit(1)

  if (!nextUp) {
    // Everyone's had a turn this cycle — reset and re-pick.
    await db
      .update(fbinqForwarding)
      .set({ shiftStatus: 'N' })
      .where(
        and(
          eq(fbinqForwarding.shiftStatus, 'Y'),
          eq(fbinqForwarding.status, 'Y'),
          eq(fbinqForwarding.userAdminId, userAdminId),
          eq(fbinqForwarding.forSourceId, String(sourceId)),
        ),
      )
    ;[nextUp] = await db.select().from(fbinqForwarding).where(nextUpCondition).limit(1)
  }

  const jrId = nextUp?.empId > 0 ? nextUp.empId : userAdminId

  await db
    .update(fbinqForwarding)
    .set({ shiftStatus: 'Y' })
    .where(
      and(
        eq(fbinqForwarding.empId, jrId),
        eq(fbinqForwarding.status, 'Y'),
        eq(fbinqForwarding.userAdminId, userAdminId),
        eq(fbinqForwarding.forSourceId, String(sourceId)),
      ),
    )

  return jrId
}
