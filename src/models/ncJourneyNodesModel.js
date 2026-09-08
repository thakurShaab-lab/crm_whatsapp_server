import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '../config/db.js'
import { ncJourneyNodes } from '../schema/ncJourneyNodes.js'

export async function findNodeBySlno(nodeSlno) {
  const [row] = await db.select().from(ncJourneyNodes).where(eq(ncJourneyNodes.nodeSlno, nodeSlno)).limit(1)
  return row || null
}

/** A journey's very first node. */
export async function findRootNode(journeyId) {
  const [row] = await db
    .select()
    .from(ncJourneyNodes)
    .where(and(eq(ncJourneyNodes.journeyId, journeyId), eq(ncJourneyNodes.nodeParentId, 0)))
    .limit(1)
  return row || null
}

/** The next node in a plain top-level chain (no branch/level filtering). */
export async function findNextByParent({ journeyId, parentId }) {
  const [row] = await db
    .select()
    .from(ncJourneyNodes)
    .where(and(eq(ncJourneyNodes.journeyId, journeyId), eq(ncJourneyNodes.nodeParentId, parentId)))
    .limit(1)
  return row || null
}

/** Same as findNextByParent but excludes "answer" nodes (node_element_type=-1) — used when resuming from a type-2 node's non-answer children. */
export async function findNextByParentExcludingAnswers({ journeyId, parentId }) {
  const [row] = await db
    .select()
    .from(ncJourneyNodes)
    .where(and(eq(ncJourneyNodes.journeyId, journeyId), eq(ncJourneyNodes.nodeParentId, parentId), ne(ncJourneyNodes.nodeElementType, '-1')))
    .limit(1)
  return row || null
}

/** Same, additionally restricted to top-level nodes (node_level_parent_id=0) — the "no sub-journey, fall back to the normal chain" case. */
export async function findNextTopLevelByParent({ journeyId, parentId }) {
  const [row] = await db
    .select()
    .from(ncJourneyNodes)
    .where(
      and(
        eq(ncJourneyNodes.journeyId, journeyId),
        eq(ncJourneyNodes.nodeParentId, parentId),
        ne(ncJourneyNodes.nodeElementType, '-1'),
        eq(ncJourneyNodes.nodeLevelParentId, 0),
      ),
    )
    .limit(1)
  return row || null
}

/** The list-reply "answer" node (node_element_type=-1) matching the received text, as a child of the interactive node it answers. */
export async function findAnswerNode({ parentId, receivedText }) {
  const [row] = await db
    .select()
    .from(ncJourneyNodes)
    .where(and(eq(ncJourneyNodes.nodeParentId, parentId), eq(ncJourneyNodes.nodeElementType, '-1'), eq(ncJourneyNodes.nodeMessageJson, receivedText)))
    .limit(1)
  return row || null
}

/** Whether an answer node has its own "sub journey" children. */
export async function hasSubJourneyChildren(levelParentId) {
  const [row] = await db.select({ nodeSlno: ncJourneyNodes.nodeSlno }).from(ncJourneyNodes).where(eq(ncJourneyNodes.nodeLevelParentId, levelParentId)).limit(1)
  return Boolean(row)
}

/** The first node of an answer's sub-journey. */
export async function findFirstSubJourneyNode({ journeyId, levelParentId }) {
  const [row] = await db
    .select()
    .from(ncJourneyNodes)
    .where(and(eq(ncJourneyNodes.journeyId, journeyId), eq(ncJourneyNodes.nodeLevelParentId, levelParentId)))
    .orderBy(asc(ncJourneyNodes.nodeParentId))
    .limit(1)
  return row || null
}
