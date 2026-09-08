import { db } from '../config/db.js'
import { activity } from '../schema/activity.js'

/** The "Fresh Party" follow-up task legacy creates alongside every new lead. */
export async function insertFreshPartyActivity({ jrId, userAdminId, leadId }) {
  const now = new Date()
  await db.insert(activity).values({
    createdBy: jrId,
    userAdminId,
    activityType: '1', // task
    subject: 'Fresh Party',
    dueDate: now,
    priority: 4,
    owner: jrId,
    contactName: '2', // Lead
    leadOrContactId: leadId,
    realtedTo: '1', // Account
    taskStatus: 0,
    description: 'Fresh Party',
    startDueDate: now,
    startDueTime: '',
    endDueDate: now,
    endDueTime: '',
    location: '',
    country: 0,
    participants: 0,
    callPurpose: 0,
    callType: 0,
    callDetail: 0,
    callResult: 0,
    activeStatus: '1',
    postedDealOrLead: 3, // lead
    createdAt: now,
    modifiedAt: now,
    status: '1',
    followupAddBy: 'C',
  })
}
