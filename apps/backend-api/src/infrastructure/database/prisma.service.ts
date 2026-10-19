import { createRequire } from 'node:module';

const getPrismaClient = () => {
  try {
    if (typeof require !== 'undefined') {
      return require('@prisma/client').PrismaClient;
    }
    const req = createRequire(import.meta.url);
    return req('@prisma/client').PrismaClient;
  } catch {
    return null;
  }
};

const PrismaClient = getPrismaClient();

export class PrismaService {
  private static instance: any;

  public static getInstance(): any {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    }
    return PrismaService.instance;
  }

  /**
   * Execute database queries with PostgreSQL Row-Level Security (RLS) session context
   */
  public static async withRlsContext<T>(
    context: { userId?: string; role?: string; kkId?: string },
    fn: (tx: any) => Promise<T>
  ): Promise<T> {
    const prisma = PrismaService.getInstance();

    // Use Prisma interactive transaction to scope SET LOCAL variables
    return await prisma.$transaction(async (tx: any) => {
      const userId = context.userId || '';
      const role = context.role || 'WARGA';
      const kkId = context.kkId || '';

      await tx.$executeRawUnsafe(`
        SET LOCAL app.current_user_id = '${userId}';
        SET LOCAL app.current_role = '${role}';
        SET LOCAL app.current_kk_id = '${kkId}';
      `);

      return await fn(tx);
    });
  }
}
