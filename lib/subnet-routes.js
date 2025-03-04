import { subnetPreHandlerHook } from './request-helpers.js'

export const addSubnetRoutes = (app) => {
  app.register(async (app) => {
    app.addHook('preHandler', subnetPreHandlerHook)

    app.post(
      '/:subnet/measurement',
      {
        schema: {
          body: {
            type: 'boolean'
          }
        }
      },
      async (request, reply) => {
        const { subnet } = request.params
        const client = await app.pg.connect()
        await client.query(
          'UPDATE measurements SET total = total + 1, successful = successful + $2 WHERE subnet_id = $1',
          [subnet, request.body ? 1 : 0]
        )
        reply.send()
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
              }
            }
          }
        }
      },
      async (request, reply) => {
        const { subnet } = request.params
        const client = await app.pg.connect()
        const { rows } = await client.query(
          'SELECT total, successful FROM measurements WHERE subnet_id = $1',
          [subnet]
        )
        client.release()
        reply.send(rows.length ? rows[0] : { total: 0, successful: 0 })
      }
    )
  })
}
