import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyPrivyUser } from '../lib/privy.js';
import { placeOrder } from '../lib/clob.js';
import { OrderType } from '@polymarket/clob-client-v2';

const OrderSchema = z.object({
  tokenId: z.string(),
  price: z.number().positive(),
  size: z.number().positive(),
  side: z.enum(['BUY', 'SELL']),
});

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.post('/api/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 验证 Privy 用户
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing Authorization' });
      }
      const accessToken = authHeader.split(' ')[1];
      const user = await verifyPrivyUser(accessToken);

      // 校验请求参数
      const body = OrderSchema.parse(request.body);

      console.log(`用户 ${user.userId} 下单: ${body.side} ${body.size} @ ${body.price}`);

      // 调用下单
      const result = await placeOrder({
        tokenId: body.tokenId,
        price: body.price,
        size: body.size,
        side: body.side,
      });

      return reply.send({
        success: true,
        orderID: result.orderID,
        status: result.status,
        userId: user.userId,
      });
    } catch (error: any) {
      console.error('下单失败:', error);
      return reply.code(500).send({ error: error.message || '下单失败' });
    }
  });
}
