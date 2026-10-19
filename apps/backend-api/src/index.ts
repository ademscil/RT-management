import 'dotenv/config';
import { createServer } from './presentation/server.js';

const app = createServer();
const port = Number(process.env.PORT) || 3001;

async function start() {
  try {
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

start();
