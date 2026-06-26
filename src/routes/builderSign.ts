import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildHmacSignature, type BuilderApiKeyCreds } from '@polymarket/builder-signing-sdk';

const BUILDER_CREDENTIALS: BuilderApiKeyCreds = {
  key: process.env.POLYMARKET_BUILDER_API_KEY || '',
  secret: process.env.POLYMARKET_BUILDER_SECRET || '',
  passphrase: process.env.POLYMARKET_BUILDER_PASSPHRASE || '',
};

type SignBody = {
  method?: string;
  path?: string;
  body?: string;
};

export async function builderSignRoutes(fastify: FastifyInstance) {
  fastify.post('/api/builder/sign', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!BUILDER_CREDENTIALS.key || !BUILDER_CREDENTIALS.secret || !BUILDER_CREDENTIALS.passphrase) {
        return reply.code(503).send({
          error: 'Builder API credentials not configured (POLYMARKET_BUILDER_API_KEY/SECRET/PASSPHRASE)',
        });
      }

      const { method, path, body: requestBody } = request.body as SignBody;

      if (!method || !path || requestBody === undefined) {
        return reply.code(400).send({ error: 'Missing required parameters: method, path, body' });
      }

      const sigTimestamp = Date.now().toString();
      const signature = buildHmacSignature(
        BUILDER_CREDENTIALS.secret,
        parseInt(sigTimestamp, 10),
        method,
        path,
        requestBody,
      );

      return reply.send({
        POLY_BUILDER_SIGNATURE: signature,
        POLY_BUILDER_TIMESTAMP: sigTimestamp,
        POLY_BUILDER_API_KEY: BUILDER_CREDENTIALS.key,
        POLY_BUILDER_PASSPHRASE: BUILDER_CREDENTIALS.passphrase,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign';
      fastify.log.error(error);
      return reply.code(500).send({ error: message });
    }
  });
}
