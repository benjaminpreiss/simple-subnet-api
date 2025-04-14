import assert from 'node:assert'
import { after, before, beforeEach, describe, it } from 'node:test'
import { migrateWithPgClient } from '../lib/migrate.js'
import { createPgPool } from '../lib/pool.js'
import { createApp } from '../lib/app.js'
import {
  assertResponseStatus,
  postMeasurement,
  withSubnetMeasurements
} from './test-helpers.js'
import { DATABASE_URL, poolConfig } from '../lib/config.js'
import { today, yesterday } from '../lib/date.js'

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
      dbPoolConfig: poolConfig,
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
    await pgPool.query('DELETE FROM daily_measurements')
  })

  describe('/:subnet/measurement', () => {
    it('submit successful measurement - no previous daily_measurements', async () => {
      const day = today()
      const subnet = 'walrus'
      const res = await postMeasurement(baseUrl, subnet, { retrievalSucceeded: true })
      await assertResponseStatus(res, 200)

      const { rows } = await pgPool.query(
        'SELECT total, successful FROM daily_measurements WHERE subnet = $1 AND day = $2',
        [subnet, day]
      )
      assert.deepStrictEqual(rows, [{ total: 1n, successful: 1n }])
    })

    it('submit successful measurement - has previous daily_measurements', async () => {
      const day = today()
      const subnet = 'walrus'
      await withSubnetMeasurements({ pgPool, day, subnet, successful: 0, total: 0 })
      const res = await postMeasurement(baseUrl, subnet, { retrievalSucceeded: true })
      await assertResponseStatus(res, 200)

      const { rows } = await pgPool.query(
        'SELECT total, successful FROM daily_measurements WHERE subnet = $1 AND day = $2',
        [subnet, day]
      )
      assert.deepStrictEqual(rows, [{ total: 1n, successful: 1n }])
    })

    it('submit unsuccessful measurement - no previous measurements', async () => {
      const day = today()
      const subnet = 'walrus'
      const res = await postMeasurement(baseUrl, subnet, { retrievalSucceeded: false })
      await assertResponseStatus(res, 200)
      const { rows } = await pgPool.query(
        'SELECT total, successful FROM daily_measurements WHERE subnet = $1 AND day = $2',
        [subnet, day]
      )
      assert.deepStrictEqual(rows, [{ total: 1n, successful: 0n }])
    })

    it('submit unsuccessful measurement - has previous measurements', async () => {
      const day = today()
      const subnet = 'walrus'
      await withSubnetMeasurements({ pgPool, day, subnet, total: 0, successful: 0 })
      const res = await postMeasurement(baseUrl, subnet, { retrievalSucceeded: false })
      await assertResponseStatus(res, 200)
      const { rows } = await pgPool.query(
        'SELECT total, successful FROM daily_measurements WHERE subnet = $1 AND day = $2',
        [subnet, day]
      )
      assert.deepStrictEqual(rows, [{ total: 1n, successful: 0n }])
    })

    it('submit successful measurement - unknown subnet', async () => {
      const day = today()
      const subnet = 'walrus'
      const unknownSubnet = 'unknown-subnet'
      await withSubnetMeasurements({ pgPool, day, subnet, total: 0, successful: 0 })

      const res = await postMeasurement(baseUrl, /** @type {any} */(unknownSubnet), { retrievalSucceeded: true })

      await assertResponseStatus(res, 400)
    })
  })

  describe('/:subnet/retrieval-success-rate', () => {
    it('returns retrieval success rate for today by default', async () => {
      const subnet = 'walrus'
      await withSubnetMeasurements({ pgPool, day: yesterday(), subnet, total: 10, successful: 5 })
      await withSubnetMeasurements({ pgPool, day: today(), subnet, total: 5, successful: 3 })

      const res = await fetch(new URL(`/${subnet}/retrieval-success-rate`, baseUrl))
      await assertResponseStatus(res, 200)

      /** @type {any} */
      const data = await res.json()
      assert.deepStrictEqual(data, [{ day: today(), total: '5', successful: '3' }])
    })

    it('sets default query string value for time range', async () => {
      const subnet = 'walrus'
      await withSubnetMeasurements({ pgPool, day: yesterday(), subnet, total: 10, successful: 5 })
      await withSubnetMeasurements({ pgPool, day: today(), subnet, total: 5, successful: 3 })

      const res = await fetch(new URL(`/${subnet}/retrieval-success-rate?from=${yesterday()}`, baseUrl))
      await assertResponseStatus(res, 200)

      /** @type {any} */
      const data = await res.json()
      assert.deepStrictEqual(data, [
        { day: yesterday(), total: '10', successful: '5' },
        { day: today(), total: '5', successful: '3' }
      ])
    })

    it('returns retrieval success rate for specified range', async () => {
      const from = '2025-01-01'
      const to = '2025-01-02'
      const subnet = 'walrus'
      // before range
      await withSubnetMeasurements({ pgPool, day: '2024-12-01', subnet, total: 5, successful: 5 })
      await withSubnetMeasurements({ pgPool, day: '2024-12-02', subnet, total: 3, successful: 2 })
      // in range
      await withSubnetMeasurements({ pgPool, day: '2025-01-01', subnet, total: 10, successful: 7 })
      await withSubnetMeasurements({ pgPool, day: '2025-01-02', subnet, total: 20, successful: 0 })
      // after range
      await withSubnetMeasurements({ pgPool, day: yesterday(), subnet, total: 10, successful: 5 })
      await withSubnetMeasurements({ pgPool, day: today(), subnet, total: 5, successful: 3 })

      const res = await fetch(new URL(`/${subnet}/retrieval-success-rate?from=${from}&to=${to}`, baseUrl))
      await assertResponseStatus(res, 200)

      /** @type {any} */
      const data = await res.json()
      assert.deepStrictEqual(data, [
        { day: from, total: '10', successful: '7' },
        { day: to, total: '20', successful: '0' }
      ])
    })

    it('returns 400 for unknown subnets', async () => {
      const res = await fetch(new URL('/unknown-subnet/retrieval-success-rate', baseUrl))
      await assertResponseStatus(res, 400)
    })
  })
})

describe('Subnet v2 routes', () => {
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
      dbPoolConfig: poolConfig,
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
    await pgPool.query('DELETE FROM measurements_for_avg')
    await pgPool.query('DELETE FROM measurements_discrete')
    await pgPool.query('DELETE FROM subnet_checks')
  })

  describe('POST /v2/:subnet/measurement', () => {
    it('insert a new avg measurement - no existing subnet_check', async () => {
      const subnet = 'allsyn'
      const body = {
        checkKey: 'key1',
        checkSubject: 'subject1',
        success: true,
        result: 100,
        averageable: true
      }
      const res = await fetch(new URL(`/v2/${subnet}/measurement`, baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      await assertResponseStatus(res, 200)

      const { rows: checkRows } = await pgPool.query(
        'SELECT id FROM subnet_checks WHERE subnet = $1 AND check_subject = $2',
        [subnet, 'subject1']
      )
      assert.strictEqual(checkRows.length, 1)

      const subnetCheckId = checkRows[0].id

      const { rows: measurementRows } = await pgPool.query(
        'SELECT * FROM measurements_for_avg WHERE subnet_check_id = $1',
        [subnetCheckId]
      )
      assert.strictEqual(measurementRows.length, 1)
      assert.strictEqual(measurementRows[0].result, 100)
    })

    it('insert a new discrete measurement - no existing subnet_check', async () => {
      const subnet = 'walrus'
      const body = {
        checkKey: 'key2',
        checkSubject: 'subject2',
        success: false,
        result: 'error',
        averageable: false
      }
      const res = await fetch(new URL(`/v2/${subnet}/measurement`, baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      await assertResponseStatus(res, 200)

      const { rows: checkRows } = await pgPool.query(
        'SELECT id FROM subnet_checks WHERE subnet = $1 AND check_subject = $2',
        [subnet, 'subject2']
      )
      assert.strictEqual(checkRows.length, 1)

      const subnetCheckId = checkRows[0].id

      const { rows: measurementRows } = await pgPool.query(
        'SELECT * FROM measurements_discrete WHERE subnet_check_id = $1',
        [subnetCheckId]
      )
      assert.strictEqual(measurementRows.length, 1)
      assert.strictEqual(measurementRows[0].result, 'error')
    })
  })

  describe('GET /v2/:subnet/aggregates/:length', () => {
    it('retrieves minutely aggregates for the last day', async () => {
      const subnet = 'walrus'
      const subnetCheckId = await withMockedSubnetCheck(pgPool, { subnet, checkSubject: 'subject1' })

      // Insert a mock data entry within the time span we're going to query
      await pgPool.query(
        'INSERT INTO minute_stats (bucket_time, subnet_check_id, check_key, total_checks, successful_checks, success_rate, avg_result) VALUES (now(), $1, $2, $3, $4, $5, $6)',
        [subnetCheckId, 'key1', 150, 120, 0.8, 200]
      )

      // Calculate date range for the last 24 hours
      const currentEpoch = Date.now()
      const oneDayAgoEpoch = currentEpoch - (24 * 60 * 60 * 1000) // 24 hours in milliseconds

      const from = new Date(oneDayAgoEpoch).toISOString()
      const to = new Date(currentEpoch).toISOString()

      const res = await fetch(new URL(`/v2/${subnet}/aggregates/minutely?from=${from}&to=${to}&checkSubject=subject1`, baseUrl))
      await assertResponseStatus(res, 200)

      /** @type {any} */
      const data = await res.json()
      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].total_checks, 150)
    })

    it('returns 404 if subnet_check does not exist for the queried subject', async () => {
      const subnet = 'walrus'
      const currentEpoch = Date.now()
      const oneDayAgoEpoch = currentEpoch - (24 * 60 * 60 * 1000)

      const from = new Date(oneDayAgoEpoch).toISOString()
      const to = new Date(currentEpoch).toISOString()

      const res = await fetch(new URL(`/v2/${subnet}/aggregates/minutely?from=${from}&to=${to}&checkSubject=nonexistent`, baseUrl))
      await assertResponseStatus(res, 404)
    })
  })

  describe('GET /v2/:subnet/discrete_aggregates/:length', () => {
    it('retrieves minutely discrete aggregates for the last day', async () => {
      const subnet = 'walrus'
      const subnetCheckId = await withMockedSubnetCheck(pgPool, { subnet, checkSubject: 'subject2' })

      // Insert a mock discrete data entry within the time span we're going to query
      await pgPool.query(
        `INSERT INTO minute_stats_discrete (bucket_time, subnet_check_id, check_key, total_checks, successful_checks, results)
         VALUES (now(), $1, $2, $3, $4, $5)`,
        [subnetCheckId, 'key2', 20, 10, ['result1', 'result2']]
      )

      // Calculate date range for the last 24 hours
      const currentEpoch = Date.now()
      const oneDayAgoEpoch = currentEpoch - (24 * 60 * 60 * 1000) // 24 hours in milliseconds

      const from = new Date(oneDayAgoEpoch).toISOString()
      const to = new Date(currentEpoch).toISOString()

      const res = await fetch(new URL(`/v2/${subnet}/discrete_aggregates/minutely?from=${from}&to=${to}&checkSubject=subject2`, baseUrl))
      await assertResponseStatus(res, 200)

      /** @type {any} */
      const data = await res.json()
      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].total_checks, 20)
      assert.deepStrictEqual(data[0].results, ['result1', 'result2'])
    })

    it('retrieves hourly discrete aggregates with results as an array', async () => {
      const subnet = 'arweave'
      const subnetCheckId = await withMockedSubnetCheck(pgPool, { subnet, checkSubject: 'subject3' })

      // Insert a mock discrete data entry for hourly aggregation
      await pgPool.query(
        `INSERT INTO hourly_stats_discrete (bucket_time, subnet_check_id, check_key, total_checks, successful_checks, results)
         VALUES (now(), $1, $2, $3, $4, $5)`,
        [subnetCheckId, 'key3', 50, 25, ['result3', 'result4']]
      )

      // Calculate date range for the last 24 hours
      const currentEpoch = Date.now()
      const oneDayAgoEpoch = currentEpoch - (24 * 60 * 60 * 1000) // 24 hours in milliseconds

      const from = new Date(oneDayAgoEpoch).toISOString()
      const to = new Date(currentEpoch).toISOString()

      const res = await fetch(new URL(`/v2/${subnet}/discrete_aggregates/hourly?from=${from}&to=${to}&checkSubject=subject3`, baseUrl))
      await assertResponseStatus(res, 200)

      /** @type {any} */
      const data = await res.json()
      assert.strictEqual(data.length, 1)
      assert.strictEqual(data[0].total_checks, 50)
      assert.deepStrictEqual(data[0].results, ['result3', 'result4'])
    })

    it('returns 404 if subnet_check does not exist for the queried discrete subject', async () => {
      const subnet = 'arweave'
      const currentEpoch = Date.now()
      const oneDayAgoEpoch = currentEpoch - (24 * 60 * 60 * 1000)

      const from = new Date(oneDayAgoEpoch).toISOString()
      const to = new Date(currentEpoch).toISOString()

      const res = await fetch(new URL(`/v2/${subnet}/discrete_aggregates/minutely?from=${from}&to=${to}&checkSubject=nonexistent-discrete`, baseUrl))
      await assertResponseStatus(res, 404)
    })
  })
})

// Helper for setting up a subnet check entry
/**
 * Sets up a mock subnet check entry.
 * @param {import('pg').Pool} pgPool - The PostgreSQL connection pool.
 * @param {{ subnet: string, checkSubject: string }} options - Options containing subnet and checkSubject.
 * @returns {Promise<number>} - The ID of the created or existing subnet check.
 */
async function withMockedSubnetCheck (pgPool, { subnet, checkSubject }) {
  const { rows } = await pgPool.query(
    `INSERT INTO subnet_checks (subnet, check_subject, created_at)
     VALUES ($1, $2, now())
     ON CONFLICT (subnet, check_subject) DO UPDATE SET subnet = excluded.subnet
     RETURNING id`,
    [subnet, checkSubject]
  )
  return rows[0].id
}
