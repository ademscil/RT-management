import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { SSEBrokerService } from '../infrastructure/realtime/sse-broker.service.js';
import { authRoutes } from './routes/auth.routes.js';
import { kependudukanRoutes } from './routes/kependudukan.routes.js';
import { suratRoutes } from './routes/surat.routes.js';
import { keuanganRoutes } from './routes/keuangan.routes.js';
import { operasionalRoutes } from './routes/operasional.routes.js';
import { notificationRoutes } from './routes/notifications.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { onboardingRoutes } from './routes/onboarding.routes.js';
import { configRoutes } from './routes/config.routes.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { BootstrapService } from '../infrastructure/database/bootstrap.service.js';
import { SecretManager } from '../infrastructure/crypto/secret-manager.service.js';
import { ErrorCode } from '@simrt/shared-types';

export function createServer(): FastifyInstance {
  const app = fastify({
    logger: process.env.NODE_ENV === 'development',
    trustProxy: true,
  });

  const sseBroker = new SSEBrokerService();
  (app as any).sseBroker = sseBroker;

  // 1. Security Headers via Helmet (configured for cross-origin API engine)
  app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // 2. CORS configuration (allowing web portal & admin panel cross-origin)
  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'x-rt-id',
      'X-RT-ID',
      'x-tenant-id',
      'X-Tenant-ID',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'x-rt-id', 'X-RT-ID'],
  });

  // 3. JWT configuration (CWE-798 compliant - zero hardcoded secrets)
  app.register(jwt, {
    secret: SecretManager.getJwtAccessSecret(),
  });

  // 3.1 Multipart/Form-Data support for document & receipt uploads
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // 4. Rate Limiting (Brute-force protection)
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // 5. Global Health Check & Keep-Warm Endpoint (exempt from rate limiting)
  const healthHandler = async (req: any) => {
    let dbStatus = 'skipped';
    let superuserStatus = 'skipped';
    let purgeStatus = 'skipped';

    if (req.query?.warm === '1' || req.query?.db === '1') {
      try {
        const prisma = PrismaService.getInstance();
        if (prisma) {
          await prisma.$queryRawUnsafe('SELECT 1');
          dbStatus = 'connected';

          // Automatically ensure SUPERUSER account exists in PostgreSQL
          const su = await BootstrapService.ensureSuperuser(prisma);
          superuserStatus = su.created ? 'created' : 'ready';

          // Automatically ensure active RT Configuration
          let rtCustom;
          if (req.query?.set_rt_pangkalpinang === '1') {
            rtCustom = {
              kodeRt: '010',
              kodeRw: '003',
              namaKelurahan: 'Taman Bunga',
              namaKecamatan: 'Gerunggang',
              namaKota: 'Kota Pangkalpinang',
              kodePos: '33119',
            };
          }
          await BootstrapService.ensureRtConfig(prisma, rtCustom);

          // Purge dummy demo data if explicitly requested
          if (req.query?.purge_dummy === '1') {
            const p = await BootstrapService.purgeDummyData(prisma);
            purgeStatus = `purged: ${p.deletedDemoUsers} users, ${p.deletedDemoHouses} houses`;
          }
        }
      } catch (err: any) {
        dbStatus = `error: ${err.message}`;
      }
    }
    return {
      status: 'healthy',
      system: 'SIM-RT Enterprise Engine',
      db: dbStatus,
      superuser: superuserStatus,
      purge: purgeStatus,
      time: new Date().toISOString(),
    };
  };

  app.get('/health', { config: { rateLimit: false } }, healthHandler);
  app.get('/api/v1/health', { config: { rateLimit: false } }, healthHandler);

  // 6. Register Modular API Routes
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(kependudukanRoutes, { prefix: '/api/v1/kependudukan' });
  app.register(suratRoutes, { prefix: '/api/v1/surat' });
  app.register(keuanganRoutes, { prefix: '/api/v1/keuangan' });
  app.register(operasionalRoutes, { prefix: '/api/v1/operasional' });
  app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  app.register(auditRoutes, { prefix: '/api/v1/audit' });
  app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  app.register(configRoutes, { prefix: '/api/v1/config' });

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
