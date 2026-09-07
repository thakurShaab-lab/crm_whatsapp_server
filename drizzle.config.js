import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const user = encodeURIComponent(process.env.DB_USER || 'root')
const password = encodeURIComponent(process.env.DB_PASSWORD || '')
const host = process.env.DB_HOST || 'localhost'
const port = process.env.DB_PORT || 3306
const database = process.env.DB_NAME || 'web_crm_whatsapp'

export default defineConfig({
  dialect: 'mysql',
  schema: './src/schema/*.js',
  out: './src/db/migrations',
  dbCredentials: {
    url: `mysql://${user}:${password}@${host}:${port}/${database}`,
  },
})
