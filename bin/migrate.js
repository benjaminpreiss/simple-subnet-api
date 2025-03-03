import { migrateWithPgClient, createPgPool } from '../lib/migrate.js'

const {
  // DATABASE_URL points to `spark_deal_observer` database managed by this monorepo
  DATABASE_URL = 'postgres://localhost:5432/simple_subnet_api'
} = process.env

const pgPool = await createPgPool(DATABASE_URL)
await migrateWithPgClient(pgPool)
