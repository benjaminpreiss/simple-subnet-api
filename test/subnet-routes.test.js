import assert from 'node:assert'
import { after, before, beforeEach, describe, it } from 'node:test'
import { migrateWithPgClient } from '../lib/migrate.js'
import { createPgPool } from '../lib/pool.js'
import { createApp } from '../lib/app.js'
import {
  assertResponseStatus,
  withSubnetMeasurements
} from './test-helpers.js'
import { DATABASE_URL } from '../lib/config.js'

describe('Subnet routes', () => {
  /** @type {import('pg').Pool} */
  let pgPool
  /** @type {import('fastify').FastifyInstance} */
  let app
  /** @type {string} */
  let baseUrl

  before(async () => {
    pgPool = await createPgPool(DATABASE_URL)
    await migrateWithPgClient(pgPool)

    app = createApp({
      databaseUrl: DATABASE_URL,
      logger: {
        level:
          process.env.DEBUG === '*' || process.env.DEBUG?.includes('test')
            ? 'debug'
            : 'error'
      }
    })

    baseUrl = await app.listen()
  })

  after(async () => {
    await app.close()
    await pgPool.end()
  })

  beforeEach(async () => {
    await pgPool.query('DELETE FROM measurements')
  })

  describe('/:subnet/measurement', () => {
    it('submit successful measurement', async () => {
      const subnet = 'walrus'
      await withSubnetMeasurements(pgPool, subnet, 0, 0)
      const res = await fetch(new URL(`/${subnet}/measurement`, baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(true)
      })
      await assertResponseStatus(res, 200)

      const { rows } = await pgPool.query(
        'SELECT total, successful FROM measurements WHERE subnet = $1',
        [subnet]
      )
      assert.deepStrictEqual(rows, [{ total: 1n, successful: 1n }])
    })

    it('submit unsuccessful measurement', async () => {
      const subnet = 'walrus'
      await withSubnetMeasurements(pgPool, subnet, 0, 0)
      const res = await fetch(new URL(`/${subnet}/measurement`, baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(false)
      })
      await assertResponseStatus(res, 200)

      const { rows } = await pgPool.query(
        'SELECT total, successful FROM measurements WHERE subnet = $1',
        [subnet]
      )
      assert.deepStrictEqual(rows, [{ total: 1n, successful: 0n }])
    })

    it('submit successful measurement - unknown subnet', async () => {
      const subnet = 'walrus'
      const unknownSubnet = 'unknown-subnet'
      await withSubnetMeasurements(pgPool, subnet, 0, 0)
      const res = await fetch(new URL(`/${unknownSubnet}/measurement`, baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(false)
      })

      await assertResponseStatus(res, 404)
    })
  })

  describe('/:subnet', () => {
    it('returns measurement data for GET /:subnet', async () => {
      const subnet = 'walrus'
      await withSubnetMeasurements(pgPool, subnet, 5, 3)

      const res = await fetch(new URL(`/${subnet}`, baseUrl))
      await assertResponseStatus(res, 200)

      /** @type {any} */
      const data = await res.json()
      assert.deepStrictEqual(data, { total: '5', successful: '3' })
    })

    it('returns 404 for unknown subnets', async () => {
      const res = await fetch(new URL('/unknown-subnet', baseUrl))
      await assertResponseStatus(res, 404)
    })
  })
})
