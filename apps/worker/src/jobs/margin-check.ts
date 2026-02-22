import type { PrismaClient } from "@prisma/client";

interface MarginCheckInput {
  rateCardId: string;
}

export async function handleMarginCheck(
  prisma: PrismaClient,
  data: MarginCheckInput
): Promise<void> {
  const { rateCardId } = data;
  if (!rateCardId) return;

  const rateCard = await prisma.rateCard.findUnique({
    where: { id: rateCardId },
  });
  if (!rateCard) return;

  const {
    billRate,
    payRate,
    burdenPct,
    vendorCutPct,
    payrollTaxPct,
    portalFeePct,
    otherFees,
    minMarginTarget,
  } = rateCard;

  const grossMarginHr = billRate - payRate;

  const netMarginHr =
    grossMarginHr -
    (payRate * burdenPct) / 100 -
    (billRate * vendorCutPct) / 100 -
    (payRate * payrollTaxPct) / 100 -
    (billRate * portalFeePct) / 100 -
    otherFees;

  const marginSafe = netMarginHr >= minMarginTarget;

  await prisma.rateCard.update({
    where: { id: rateCardId },
    data: {
      grossMarginHr,
      netMarginHr,
      marginSafe,
    },
  });
}
