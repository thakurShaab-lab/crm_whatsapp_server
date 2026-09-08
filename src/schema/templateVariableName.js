import { mysqlTable, int, varchar, datetime } from 'drizzle-orm/mysql-core'

/**
 * Maps `template_variable_name` — one row per `{{N}}` placeholder a template uses.
 * `sec_type_field_name` holds "<prefix>~<field>" (e.g. "cstmr~account_name"); legacy
 * appends `~vid` to build a unique array key, so the value itself only ever carries
 * the prefix+field pair — see templateAutomation.js's `resolveVariableValue`.
 */
export const templateVariableName = mysqlTable('template_variable_name', {
  id: int('id').autoincrement().primaryKey(),
  tid: int('tid').notNull(),
  vid: int('vid').notNull(),
  variableName: varchar('variable_name', { length: 255 }).notNull(),
  secTypeFieldName: varchar('sec_type_field_name', { length: 100 }),
  recvDate: datetime('recvDate').notNull(),
})
