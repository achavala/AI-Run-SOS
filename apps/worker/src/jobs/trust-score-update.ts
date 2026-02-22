import type { PrismaClient } from "@prisma/client";

interface TrustScoreUpdateInput {
  entityType: string;
  entityId: string;
}

export async function handleTrustScoreUpdate(
  prisma: PrismaClient,
  data: TrustScoreUpdateInput
): Promise<void> {
  const { entityType, entityId } = data;
  if (!entityType || !entityId) return;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const trustEvents = await prisma.trustEvent.findMany({
    where: {
      entityType,
      entityId,
      createdAt: { gte: ninetyDaysAgo },
    },
    orderBy: { createdAt: "asc" },
  });

  if (trustEvents.length === 0) return;

  // Weighted average: recent events weighted more (linear decay from oldest to newest)
  let weightedSum = 0;
  let weightSum = 0;
  for (let i = 0; i < trustEvents.length; i++) {
    const event = trustEvents[i];
    if (!event) continue;
    const score = event.score ?? event.delta ?? 0;
    const weight = (i + 1) / trustEvents.length;
    weightedSum += score * weight;
    weightSum += weight;
  }
  const trustScore = weightSum > 0 ? weightedSum / weightSum : 0;

  if (entityType === "Vendor") {
    await prisma.vendor.update({
      where: { id: entityId },
      data: { trustScore },
    });
  } else if (entityType === "Consultant") {
    await prisma.consultant.update({
      where: { id: entityId },
      data: { trustScore },
    });
  }
}
