import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'web_crm_whatsapp',
  multipleStatements: true,
})

const db = drizzle(connection)

await migrate(db, { migrationsFolder: './src/db/migrations' })
console.log('[migrate] done')

await connection.end()
