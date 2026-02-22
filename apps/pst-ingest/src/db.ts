import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.DEBUG ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

export default prisma;
