/** @import { RequestWithSubnet } from './typings.js' */
/** @import { FastifyInstance, FastifyReply } from 'fastify' */
import { subnetPreHandlerHook } from './request-helpers.js'

/**
 * Define the subnet routes
 * @param {FastifyInstance} app
 */
export const subnetRoutes = (app) => {
  app.addHook('preHandler', subnetPreHandlerHook)

  app.post(
    '/:subnet/measurement',
    {
      schema: {
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
     * @param {RequestWithSubnet} request
     * @param {FastifyReply} reply
     */
    async (request, reply) => {
      const client = await app.pg.connect()
      try {
        await client.query(
          'UPDATE measurements SET total = total + 1, successful = successful + $1 WHERE subnet = $2',
          [request.body ? 1 : 0, request.params.subnet]
        )
      } finally {
        client.release()
      }
    }
  )

  app.get(
    '/:subnet',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
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
    },
    /**
     * @param {RequestWithSubnet} request
     * @param {FastifyReply} reply
     */
    async (request, reply) => {
      const client = await app.pg.connect()
      try {
        const { rows } = await client.query(
          'SELECT total, successful FROM measurements WHERE subnet = $1',
          [request.params.subnet]
        )

        reply.send(rows[0])
      } finally {
        client.release()
      }
    }
  )
}
