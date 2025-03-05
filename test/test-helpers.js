import { AssertionError } from 'node:assert'

/**
 * @param {Response} res
 * @param {number} status
 */
export const assertResponseStatus = async (res, status) => {
  if (res.status !== status) {
    throw new AssertionError({
      actual: res.status,
      expected: status,
      message: await res.text()
    })
  }
}

/**
 *
 * @param {import('../lib/typings.js').PgPool} pgPool
 * @param {import('../lib/typings.js').Subnet} subnet
 * @param {number} total
 * @param {number} successful
 */
export const withSubnetMeasurements = async (
  pgPool,
  subnet,
  total,
  successful
) => {
  await pgPool.query(
    'INSERT INTO measurements (subnet, total, successful) VALUES ($1, $2, $3)',
    [subnet, total, successful]
  )
}

/**
 * @param {string} baseUrl
 * @param {import('../lib/typings.js').Subnet} subnet
 * @param {boolean} retrievalSucceeded
 */
export const postMeasurement = (baseUrl, subnet, retrievalSucceeded) => {
  return fetch(new URL(`/${subnet}/measurement`, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ retrievalSucceeded })
  })
}
