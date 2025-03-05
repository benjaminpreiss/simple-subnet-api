/** @import { RequestWithSubnet } from './typings.js' */
/** @import { FastifyInstance, FastifyReply } from 'fastify' */

const subnetRoutesDefaultParamsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subnet: {
      type: 'string',
      pattern: '^(walrus|arweave)$'
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
          'UPDATE measurements SET total = total + 1, successful = successful + $1 WHERE subnet = $2',
          [request.body.retrievalSucceeded ? 1 : 0, request.params.subnet]
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
