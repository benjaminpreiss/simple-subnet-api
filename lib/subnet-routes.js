/** @import { RequestWithSubnet, RequestWithSubnetV2 } from './typings.js' */
/** @import { FastifyInstance, FastifyReply } from 'fastify' */

import { today } from './date.js'

const subnetRoutesDefaultParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subnet: {
      type: 'string',
      pattern: '^(walrus|arweave|allsyn)$'
    }
  },
  required: ['subnet']
}

/**
 * Define the subnet routes
 * @param {FastifyInstance} app
 */
export const subnetRoutes = (app) => {
  app.post(
    '/:subnet/measurement',
    {
      schema: {
        params: subnetRoutesDefaultParamsSchema,
        body: {
          type: 'object',
          properties: {
            retrievalSucceeded: {
              type: 'boolean'
            }
          },
          required: ['retrievalSucceeded']
        }
      }
    },
    /**
     * @param {RequestWithSubnet<{retrievalSucceeded: boolean}>} request
     * @param {FastifyReply} reply
     */
    async (request, reply) => {
      const client = await app.pg.connect()
      try {
        await client.query(
          `INSERT INTO daily_measurements (subnet, day, total, successful)
           VALUES ($1, current_date, 1, $2)
           ON CONFLICT (subnet, day)
           DO UPDATE SET total = daily_measurements.total + 1, successful = daily_measurements.successful + $2`,
          [request.params.subnet, request.body.retrievalSucceeded ? 1 : 0]
        )
      } finally {
        client.release()
      }
    }
  )

  app.get(
    '/:subnet/retrieval-success-rate',
    {
      schema: {
        params: subnetRoutesDefaultParamsSchema,
        querystring: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              format: 'date'
            },
            to: {
              type: 'string',
              format: 'date'
            }
          }
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: {
                  type: 'string',
                  format: 'date'
                },
                total: {
                  type: 'string',
                  format: 'int64',
                  pattern: '^[0-9]*$'
                },
                successful: {
                  type: 'string',
                  format: 'int64',
                  pattern: '^[0-9]*$'
                }
              },
              required: ['total', 'successful']
            }
          }
        }
      }
    },
    /**
     * @param {RequestWithSubnet<{}, {from: string; to: string}>} request
     * @param {FastifyReply} reply
     */
    async (request, reply) => {
      const client = await app.pg.connect()
      const from = request.query.from || today()
      const to = request.query.to || today()
      try {
        const { rows } = await client.query(
          `SELECT day, total, successful FROM daily_measurements
           WHERE subnet = $1 AND day >= $2 AND day <= $3
           GROUP BY subnet, day ORDER BY day`,
          [request.params.subnet, from, to]
        )
        reply.send(rows)
      } finally {
        client.release()
      }
    }
  )

  // New POST endpoint for measurements (version 2)
  app.post(
    '/v2/:subnet/measurement',
    {
      schema: {
        params: subnetRoutesDefaultParamsSchema,
        body: {
          type: 'object',
          properties: {
            checkKey: { type: 'string' },
            checkSubject: { type: 'string' },
            success: { type: 'boolean' },
            result: { type: 'string' },
            averageable: { type: 'boolean' }
          },
          required: ['checkKey', 'checkSubject', 'success', 'result', 'averageable']
        }
      }
    },
    /**
     * @param {RequestWithSubnet<{checkKey: string, checkSubject: string, success: boolean, result: number | string, averageable: boolean}>} request
     * @param {FastifyReply} reply
     */
    async (request, reply) => {
      const { checkKey, checkSubject, success, result, averageable } = request.body
      const { subnet } = request.params
      const client = await app.pg.connect()

      // Validate the type of result based on the averageable flag

      const typedResult = averageable ? Number(result) : result

      const table = averageable ? 'measurements_for_avg' : 'measurements_discrete'

      try {
        // Handle subnet check creation or retrieval
        const { rows } = await client.query(
          `INSERT INTO subnet_checks (subnet, check_subject, created_at)
           VALUES ($1, $2, now())
           ON CONFLICT (subnet, check_subject) DO UPDATE SET subnet = excluded.subnet
           RETURNING id`,
          [subnet, checkSubject]
        )

        const subnetCheckId = rows[0].id

        // Insert into the appropriate measurements table
        await client.query(
          `INSERT INTO ${table} (time, subnet_check_id, check_key, success, result)
           VALUES (now(), $1, $2, $3, $4)`,
          [subnetCheckId, checkKey, success, typedResult]
        )

        reply.send({ status: 'success' })
      } catch (error) {
        reply.status(500).send({ error: 'Database error' })
      } finally {
        client.release()
      }
    }
  )

  // New GET endpoint for minutely or hourly aggregates (version 2)
  app.get(
    '/v2/:subnet/aggregates/:length',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          properties: {
            subnet: { type: 'string', pattern: '^(walrus|arweave|allsyn)$' },
            length: { type: 'string', enum: ['minutely', 'hourly'] }
          },
          required: ['subnet', 'length']
        },
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
            checkSubject: { type: 'string' }
          },
          required: ['from', 'to', 'checkSubject']
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bucket_time: { type: 'string', format: 'date-time' },
                subnet_check_id: { type: 'integer' },
                check_key: { type: 'string' },
                total_checks: { type: 'integer' },
                successful_checks: { type: 'integer' },
                success_rate: { type: 'number' },
                avg_result: { type: 'number' }
              }
            }
          }
        }
      }
    },
    /**
       * @param {RequestWithSubnetV2<{}, {from: string; to: string, checkSubject: string}>} request
       * @param {FastifyReply} reply
       */
    async (request, reply) => {
      const { from, to, checkSubject } = request.query
      const { subnet, length } = request.params
      const tableName = length === 'minutely' ? 'minute_stats' : 'hourly_stats'
      const client = await app.pg.connect()

      try {
        // Retrieve the subnet_check_id
        const { rows: checkRows } = await client.query(
            `SELECT id FROM subnet_checks
             WHERE subnet = $1 AND check_subject = $2`,
            [subnet, checkSubject]
        )

        if (checkRows.length === 0) {
          return reply.status(404).send({ error: 'No matching subnet_check_id found' })
        }

        const subnetCheckId = checkRows[0].id

        // Query the appropriate stats table
        const { rows } = await client.query(
            `SELECT bucket_time, subnet_check_id, check_key, total_checks, successful_checks, success_rate, avg_result
             FROM ${tableName}
             WHERE subnet_check_id = $1 AND bucket_time >= $2 AND bucket_time <= $3
             ORDER BY bucket_time`,
            [subnetCheckId, from, to]
        )

        reply.send(rows)
      } catch (error) {
        reply.status(500).send({ error: 'Database error' })
      } finally {
        client.release()
      }
    }
  )

  // New GET endpoint for minutely or hourly aggregates (version 2)
  app.get(
    '/v2/:subnet/discrete_aggregates/:length', // Change the path to indicate discrete aggregates
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          properties: {
            subnet: { type: 'string', pattern: '^(walrus|arweave|allsyn)$' },
            length: { type: 'string', enum: ['minutely', 'hourly'] }
          },
          required: ['subnet', 'length']
        },
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
            checkSubject: { type: 'string' }
          },
          required: ['from', 'to', 'checkSubject']
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bucket_time: { type: 'string', format: 'date-time' },
                subnet_check_id: { type: 'integer' },
                check_key: { type: 'string' },
                total_checks: { type: 'integer' },
                successful_checks: { type: 'integer' },
                results: { type: 'array', items: { type: 'string' } } // Adjust to include results as array of strings
              }
            }
          }
        }
      }
    },
    /**
     * @param {RequestWithSubnetV2<{}, {from: string; to: string, checkSubject: string}>} request
     * @param {FastifyReply} reply
     */
    async (request, reply) => {
      const { from, to, checkSubject } = request.query
      const { subnet, length } = request.params
      const tableName = length === 'minutely' ? 'minute_stats_discrete' : 'hourly_stats_discrete' // Use the discrete stats tables
      const client = await app.pg.connect()

      try {
        // Retrieve the subnet_check_id
        const { rows: checkRows } = await client.query(
            `SELECT id FROM subnet_checks
             WHERE subnet = $1 AND check_subject = $2`,
            [subnet, checkSubject]
        )

        if (checkRows.length === 0) {
          return reply.status(404).send({ error: 'No matching subnet_check_id found' })
        }

        const subnetCheckId = checkRows[0].id

        // Query the appropriate stats table
        const { rows } = await client.query(
            `SELECT bucket_time, subnet_check_id, check_key, total_checks, successful_checks, results
             FROM ${tableName}
             WHERE subnet_check_id = $1 AND bucket_time >= $2 AND bucket_time <= $3
             ORDER BY bucket_time`,
            [subnetCheckId, from, to]
        )

        reply.send(rows)
      } catch (error) {
        reply.status(500).send({ error: 'Database error' })
      } finally {
        client.release()
      }
    }
  )
}
