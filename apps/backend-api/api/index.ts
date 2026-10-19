import 'dotenv/config';
import { createServer } from '../src/presentation/server.js';

const app = createServer();

export default async function handler(req: any, res: any) {
  await app.ready();
  app.server.emit('request', req, res);
}

