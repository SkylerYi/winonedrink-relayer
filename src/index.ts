import Fastify from 'fastify';
import dotenv from 'dotenv';
import { ordersRoutes } from './routes/orders.js';

dotenv.config();

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
});

const PORT = Number(process.env.PORT || 3001);

// CORS
fastify.register(import('@fastify/cors'), {
  origin: ['http://localhost:5173', 'https://your-netlify-site.netlify.app'],
  credentials: true,
});

// 健康检查
fastify.get('/health', async () => {
  return { status: 'ok', time: new Date().toISOString() };
});

// 注册下单路由
fastify.register(ordersRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Relayer 已启动: http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
