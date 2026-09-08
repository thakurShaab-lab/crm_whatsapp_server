import { mysqlTable, int, varchar, text, datetime } from 'drizzle-orm/mysql-core'

/**
 * Maps `nc_journey_nodes` — one journey is a tree of these. `node_element_type`:
 * 0=plain text (auto-continues to its next child immediately, no reply needed),
 * 2=interactive list (sends and waits for the client's list-reply),
 * -1=an "answer" node (a possible list-reply choice, matched by `node_message_json`
 * against the received text as a child of the type-2 node it answers).
 * `node_parent_id=0` marks a journey's first node. `node_level_parent_id` links an
 * answer node's own child chain (a per-answer "sub journey") back to that answer.
 */
export const ncJourneyNodes = mysqlTable('nc_journey_nodes', {
  nodeSlno: int('node_slno').autoincrement().primaryKey(),
  journeyId: int('journey_id').default(0),
  clientId: int('client_id').notNull().default(0),
  nodeElementType: varchar('node_element_type', { length: 255 }).notNull().default(''),
  nodeParentId: int('node_parent_id').notNull().default(0),
  nodeLevelParentId: int('node_level_parent_id').notNull().default(0),
  nodeMessageJson: text('node_message_json').notNull(),
  nodeDatetime: datetime('node_datetime').notNull(),
})
