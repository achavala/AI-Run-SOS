import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async setTenantContext(tenantId: string) {
    const sanitized = tenantId.replace(/'/g, "''");
    await this.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${sanitized}'`,
    );
  }

  async withTenantContext<T>(
    tenantId: string,
    fn: (tx: TxClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      const sanitized = tenantId.replace(/'/g, "''");
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${sanitized}'`,
      );
      return fn(tx);
    });
  }
}
