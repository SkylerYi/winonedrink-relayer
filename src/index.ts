import Fastify from 'fastify';
import dotenv from 'dotenv';
import { ordersRoutes } from './routes/orders.js';
import { marketsRoutes } from './routes/markets.js';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const fastify = Fastify({
  logger: isProd
    ? true
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      },
});

const PORT = Number(process.env.PORT || 3001);

const allowedOrigins = [
  'http://localhost:5173',
  'https://famous-daffodil-58f46f.netlify.app',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
];

fastify.register(import('@fastify/cors'), {
  origin: allowedOrigins,
  credentials: true,
});

fastify.get('/', async () => ({
  service: 'WinOneDrink Relayer',
  status: 'ok',
  endpoints: ['/health', '/api/markets', 'POST /api/orders'],
}));

fastify.get('/health', async () => {
  return { status: 'ok', time: new Date().toISOString() };
});

fastify.register(marketsRoutes);
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
