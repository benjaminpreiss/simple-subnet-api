import * as Sentry from '@sentry/node'
import Fastify from 'fastify'
import pg from '@fastify/postgres'

/**
 * @param {object} args
 * @param {string} args.databaseUrl
 * @param {Fastify.FastifyLoggerOptions} args.logger
 * @returns
 */
export const createApp = ({ databaseUrl, logger }) => {
  const app = Fastify({ logger })
  Sentry.setupFastifyErrorHandler(app)
  app.register(pg, { connectionString: databaseUrl })


  app.get('/', async function handler(request, reply) {
    return 'OK'
  })

  app.post('/:subnet/measurement', {
    schema: {
      body: {
        type: 'boolean'
      }
    }
  }, async (request, reply) => {
    const { subnet } = request.params;
    const client = await app.pg.connect()
    const result = await client.query(`
      UPDATE measurements WHERE subnet = $1 SET total = total + 1, successful = successful + $2
    `, [
      subnet,
      request.body ? 1 : 0
    ])
    console.log(result)
    reply.send()
  })

  app.get('/:subnet ', async (request, reply) => {
    const { subnet } = request.params;
    const client = await app.pg.connect()
    try {
      const { rows } = await client.query('SELECT total, success FROM measurements WHERE subnet = $1', [subnet])
      reply.send(rows[0])
    }
    catch (error) {
      app.log.error(error)
      reply.status(500).send({ error })
    }
    finally {
      client.release()
    }
  })

  return app
}
