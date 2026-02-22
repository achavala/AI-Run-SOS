import type { PrismaClient } from "@prisma/client";
import { JobStatus } from "@prisma/client";

export async function handleReqFreshness(
  prisma: PrismaClient,
  _data: Record<string, unknown>
): Promise<void> {
  const activeJobs = await prisma.job.findMany({
    where: { status: JobStatus.ACTIVE },
    include: { vendor: true },
  });

  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (const job of activeJobs) {
    const daysSinceCreated =
      (now.getTime() - job.createdAt.getTime()) / oneDayMs;
    const decayFactor = Math.max(0.2, 1 - daysSinceCreated / 30);
    const vendorTrust = job.vendor.trustScore ?? 0.5;
    const podDemand = job.pod
      ? await prisma.job.count({
          where: {
            tenantId: job.tenantId,
            status: JobStatus.ACTIVE,
            pod: job.pod,
          },
        })
      : 1;
    const demandFactor = Math.min(1, 1 / Math.max(1, podDemand / 5));

    const freshnessScore =
      decayFactor * 0.4 + vendorTrust * 0.4 + demandFactor * 0.2;

    await prisma.job.update({
      where: { id: job.id },
      data: { freshnessScore },
    });
  }
}
