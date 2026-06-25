import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OrderType } from '@polymarket/clob-client-v2';
import { verifyPrivyUser } from '../lib/privy.js';
import { assertBuilderOnOrder, postSignedOrder } from '../lib/clob.js';
import { isAllowedTokenId } from '../lib/markets.js';
import { checkRateLimit } from '../lib/rateLimit.js';

const CredsSchema = z.object({
  key: z.string(),
  secret: z.string(),
  passphrase: z.string(),
});

const OrderSchema = z.object({
  signedOrder: z.record(z.unknown()),
  orderType: z.enum(['GTC', 'FOK', 'GTD', 'FAK']).default('GTC'),
  tokenId: z.string(),
  apiCreds: CredsSchema,
});

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.post('/api/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing Authorization' });
      }
      const accessToken = authHeader.split(' ')[1];
      const user = await verifyPrivyUser(accessToken);

      if (!checkRateLimit(user.userId)) {
        return reply.code(429).send({ error: 'Too many orders, try again later' });
      }

      const body = OrderSchema.parse(request.body);
      const orderPayload = (body.signedOrder.order ?? body.signedOrder) as Record<string, unknown>;
      const tokenId = String(orderPayload.tokenId ?? body.tokenId);

      if (!(await isAllowedTokenId(tokenId))) {
        return reply.code(400).send({ error: 'Token not in BTC/ETH 5min whitelist' });
      }

      assertBuilderOnOrder(orderPayload);

      console.log(`用户 ${user.userId} 提交订单 token=${tokenId}`);

      const result = await postSignedOrder({
        signedOrder: body.signedOrder,
        orderType: body.orderType as OrderType,
        creds: body.apiCreds,
      });

      return reply.send({
        success: true,
        orderID: result.orderID ?? result.id,
        status: result.status,
        userId: user.userId,
      });
    } catch (error: any) {
      console.error('下单失败:', error);
      return reply.code(500).send({ error: error.message || '下单失败' });
    }
  });
}
