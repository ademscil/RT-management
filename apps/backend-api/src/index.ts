import 'dotenv/config';
import { createServer } from './presentation/server.js';
import { MinioStorageAdapter } from './infrastructure/storage/minio-storage.adapter.js';

const app = createServer();
const port = Number(process.env.PORT) || 3001;

async function start() {
  try {
    try {
      const storage = new MinioStorageAdapter();
      await storage.initializeBuckets();
    } catch (err: any) {
      console.warn('[MinIO] Storage buckets initialization notice:', err.message);
    }

    await app.listen({ port, host: '0.0.0.0' });
    console.log(`========================================================`);
    console.log(` SIM-RT Enterprise Backend API Engine`);
    console.log(` Listening on: http://0.0.0.0:${port}`);
    console.log(` Health Check: http://localhost:${port}/health`);
    console.log(` SSE Stream:   http://localhost:${port}/api/v1/notifications/stream`);
    console.log(`========================================================`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start standalone server only when not running inside Vercel serverless environment
if (!process.env.VERCEL) {
  start();
}

// Export Fastify handler for Vercel Serverless Functions
export default async function handler(req: any, res: any) {
  await app.ready();
  app.server.emit('request', req, res);
}

export { app };
