/**
 *
 * @param {import('./typings.js').RequestWithSubnet} request
 * @param {import('fastify').FastifyReply} reply
 */
export const subnetPreHandlerHook = async (request, reply) => {
  // @ts-ignore TODO: Fix
  const { subnet } = request.params
  if (!subnet || typeof subnet !== 'string') {
    reply.code(400).send({ error: 'Invalid subnet parameter' })
    return
  }

  if (!isValidSubnet(subnet.toLowerCase())) {
    reply.code(400).send()
    console.log('Invalid subnet parameter')
  }
}

/**
 * Validate if the given subnet is either 'arweave' or 'walrus'
 * @param {string} subnet
 * @returns {subnet is Subnet}
 */
function isValidSubnet (subnet) {
  return subnet === 'arweave' || subnet === 'walrus'
}
