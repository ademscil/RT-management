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
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-rt-id, X-RT-ID, x-tenant-id, X-Tenant-ID'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: {
          message: err.message || 'Internal Server Error',
          stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        },
      })
    );
  }
}
