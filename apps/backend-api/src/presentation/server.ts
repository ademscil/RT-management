import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { SSEBrokerService } from '../infrastructure/realtime/sse-broker.service.js';
import { authRoutes } from './routes/auth.routes.js';
import { kependudukanRoutes } from './routes/kependudukan.routes.js';
import { suratRoutes } from './routes/surat.routes.js';
import { keuanganRoutes } from './routes/keuangan.routes.js';
import { operasionalRoutes } from './routes/operasional.routes.js';
import { notificationRoutes } from './routes/notifications.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { onboardingRoutes } from './routes/onboarding.routes.js';
import { ErrorCode } from '@simrt/shared-types';

export function createServer(): FastifyInstance {
  const app = fastify({
    logger: process.env.NODE_ENV === 'development',
    trustProxy: true,
  });

  const sseBroker = new SSEBrokerService();
  (app as any).sseBroker = sseBroker;

  // 1. Security Headers via Helmet
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // 2. CORS configuration
  app.register(cors, {
    origin: true,
    credentials: true,
  });

  // 3. JWT configuration
  app.register(jwt, {
    secret: process.env.JWT_ACCESS_SECRET || 'simrt_jwt_access_secret_super_secure_key_2026_xyz',
  });

  // 4. Rate Limiting (Brute-force protection)
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // 5. Global Health Check
  app.get('/health', async () => ({
    status: 'healthy',
    system: 'SIM-RT Enterprise Engine',
    time: new Date().toISOString(),
  }));

  // 6. Register Modular API Routes
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(kependudukanRoutes, { prefix: '/api/v1/kependudukan' });
  app.register(suratRoutes, { prefix: '/api/v1/surat' });
  app.register(keuanganRoutes, { prefix: '/api/v1/keuangan' });
  app.register(operasionalRoutes, { prefix: '/api/v1/operasional' });
  app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  app.register(auditRoutes, { prefix: '/api/v1/audit' });
  app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });

  // 7. Standardized Error Handling
  app.setErrorHandler((error: any, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: (error as any).code || ErrorCode.ERR_INTERNAL,
        message: statusCode === 500 ? 'Terjadi kesalahan internal pada server.' : error.message,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
