import { FastifyInstance } from 'fastify';
import { getAllowedMarkets } from '../lib/markets.js';

export async function marketsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/markets', async (_request, reply) => {
    const markets = await getAllowedMarkets();
    return reply.send({ markets });
  });
}
