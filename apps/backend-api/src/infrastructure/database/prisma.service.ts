import { PrismaClient } from '@prisma/client';

export class PrismaService {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
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
    fn: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    const prisma = PrismaService.getInstance();

    // Use Prisma interactive transaction to scope SET LOCAL variables
    return await prisma.$transaction(async (tx) => {
      const userId = context.userId || '';
      const role = context.role || 'WARGA';
      const kkId = context.kkId || '';

      await tx.$executeRawUnsafe(`
        SET LOCAL app.current_user_id = '${userId}';
        SET LOCAL app.current_role = '${role}';
        SET LOCAL app.current_kk_id = '${kkId}';
      `);

      return await fn(tx as unknown as PrismaClient);
    });
  }
}
