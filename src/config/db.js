import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import { config } from './index.js'
import * as schema from '../schema/index.js'

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: false,
})

// createPool() is lazy — it doesn't actually open a connection until the first
// query — so confirm connectivity explicitly at startup rather than staying silent
// until whatever request happens to run first.
pool
  .getConnection()
  .then((connection) => {
    console.log(`[db] connected to ${config.db.database}@${config.db.host}:${config.db.port}`)
    connection.release()
  })
  .catch((error) => {
    console.error(`[db] connection failed: ${error.message}`)
  })

export const db = drizzle(pool, { schema, mode: 'default' })