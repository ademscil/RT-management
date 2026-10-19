import 'dotenv/config';
import { createServer } from '../src/presentation/server.js';

let cachedApp: any = null;

async function getApp() {
  if (!cachedApp) {
    const app = createServer();
    await app.ready();
    cachedApp = app;
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: {
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      },
    }));
  }
}
