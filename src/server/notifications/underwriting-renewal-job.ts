import { Prisma, PrismaClient } from '@prisma/client';
import { enqueueUnderwritingSlipEmailJob } from './queue';

const RENEWAL_OFFSETS_DAYS = [60, 30, 7] as const;

function genRenewalRef() {
  return `SUN-RNW-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function markRenewalNotified(
  tx: Prisma.TransactionClient,
  tenantId: string,
  submissionId: string,
  daysBefore: number
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "renewal_notifications" ("id", "tenantId", "submissionId", "daysBefore", "sentAt", "createdAt")
    VALUES (${crypto.randomUUID()}, ${tenantId}, ${submissionId}, ${daysBefore}, NOW(), NOW())
    ON CONFLICT ("submissionId", "daysBefore")
    DO NOTHING
    RETURNING "id";
  `;

  return rows.length > 0;
}

async function ensureRenewalDraft(
  tx: Prisma.TransactionClient,
  submission: {
    id: string;
    tenantId: string;
    orgId: string | null;
    personId: string | null;
    dealId: string | null;
    vesselName: string | null;
    vesselType: string | null;
    yearBuilt: number | null;
    lengthFeet: Prisma.Decimal | null;
    hullValue: Prisma.Decimal | null;
    currency: string;
    territory: string;
    useType: string;
    navigationArea: string | null;
    navAreaModifier: string | null;
    maxSpeedKnots: number | null;
    hasAutoFireExt: boolean;
    professionalCrew: boolean;
    hasYachtingQual: boolean;
    dieselOnly: boolean;
    englishLaw: boolean;
    inlandWatersOnly: boolean;
    liabilityLimit: Prisma.Decimal | null;
    tenderValue: Prisma.Decimal | null;
    personalProperty: Prisma.Decimal | null;
    electronicsValue: Prisma.Decimal | null;
    includeTowing: boolean;
    includeTrailer: boolean;
    trailerValue: Prisma.Decimal | null;
    includeWindstorm: boolean;
    medicalExpensesLimit: number;
    uninsuredBoatersLimit: number;
    crewLiabilityLimit: number;
    hullDeductiblePct: Prisma.Decimal;
    faultClaimsCY: number;
    faultClaimsPY: number;
    faultClaims2Y: number;
    faultClaims3Y: number;
    noFaultClaims: number;
    transits: Prisma.JsonValue;
    layUpMonths: number;
    insuredName: string | null;
    brokerName: string | null;
    brokerCompany: string | null;
    brokerEmail: string | null;
    createdBy: string | null;
  }
) {
  const existing = await tx.submission.findFirst({
    where: {
      tenantId: submission.tenantId,
      sourceSubmissionId: submission.id,
      deleted: false,
      status: 'DRAFT'
    },
    select: { id: true }
  });

  if (existing) return existing.id;

  const draft = await tx.submission.create({
    data: {
      tenantId: submission.tenantId,
      reference: genRenewalRef(),
      status: 'DRAFT',
      sourceSubmissionId: submission.id,
      orgId: submission.orgId,
      personId: submission.personId,
      dealId: submission.dealId,
      vesselName: submission.vesselName,
      vesselType: submission.vesselType as any,
      yearBuilt: submission.yearBuilt,
      lengthFeet: submission.lengthFeet,
      hullValue: submission.hullValue,
      currency: submission.currency,
      territory: submission.territory as any,
      useType: submission.useType as any,
      navigationArea: submission.navigationArea,
      navAreaModifier: submission.navAreaModifier,
      maxSpeedKnots: submission.maxSpeedKnots,
      hasAutoFireExt: submission.hasAutoFireExt,
      professionalCrew: submission.professionalCrew,
      hasYachtingQual: submission.hasYachtingQual,
      dieselOnly: submission.dieselOnly,
      englishLaw: submission.englishLaw,
      inlandWatersOnly: submission.inlandWatersOnly,
      liabilityLimit: submission.liabilityLimit,
      tenderValue: submission.tenderValue,
      personalProperty: submission.personalProperty,
      electronicsValue: submission.electronicsValue,
      includeTowing: submission.includeTowing,
      includeTrailer: submission.includeTrailer,
      trailerValue: submission.trailerValue,
      includeWindstorm: submission.includeWindstorm,
      medicalExpensesLimit: submission.medicalExpensesLimit,
      uninsuredBoatersLimit: submission.uninsuredBoatersLimit,
      crewLiabilityLimit: submission.crewLiabilityLimit,
      hullDeductiblePct: submission.hullDeductiblePct,
      faultClaimsCY: submission.faultClaimsCY,
      faultClaimsPY: submission.faultClaimsPY,
      faultClaims2Y: submission.faultClaims2Y,
      faultClaims3Y: submission.faultClaims3Y,
      noFaultClaims: submission.noFaultClaims,
      transits:
        (submission.transits as Prisma.InputJsonValue | null) ??
        ([] as Prisma.InputJsonValue),
      layUpMonths: submission.layUpMonths,
      insuredName: submission.insuredName,
      brokerName: submission.brokerName,
      brokerCompany: submission.brokerCompany,
      brokerEmail: submission.brokerEmail,
      createdBy: submission.createdBy,
      uwNotes: `Renewal draft generated from ${submission.id}`
    },
    select: { id: true }
  });

  return draft.id;
}

export async function runUnderwritingRenewalJob(prisma: PrismaClient) {
  const now = new Date();

  for (const daysBefore of RENEWAL_OFFSETS_DAYS) {
    const targetDay = startOfDay(addDays(now, daysBefore));
    const targetDayEnd = addDays(targetDay, 1);

    const candidates = await prisma.submission.findMany({
      where: {
        deleted: false,
        status: { in: ['BOUND', 'POLICY_ISSUED' as never] },
        quotes: {
          some: {
            status: 'BOUND',
            validUntil: {
              gte: targetDay,
              lt: targetDayEnd
            }
          }
        }
      },
      select: {
        id: true,
        tenantId: true,
        reference: true,
        policyNumber: true,
        orgId: true,
        personId: true,
        dealId: true,
        vesselName: true,
        vesselType: true,
        yearBuilt: true,
        lengthFeet: true,
        hullValue: true,
        currency: true,
        territory: true,
        useType: true,
        navigationArea: true,
        navAreaModifier: true,
        maxSpeedKnots: true,
        hasAutoFireExt: true,
        professionalCrew: true,
        hasYachtingQual: true,
        dieselOnly: true,
        englishLaw: true,
        inlandWatersOnly: true,
        liabilityLimit: true,
        tenderValue: true,
        personalProperty: true,
        electronicsValue: true,
        includeTowing: true,
        includeTrailer: true,
        trailerValue: true,
        includeWindstorm: true,
        medicalExpensesLimit: true,
        uninsuredBoatersLimit: true,
        crewLiabilityLimit: true,
        hullDeductiblePct: true,
        faultClaimsCY: true,
        faultClaimsPY: true,
        faultClaims2Y: true,
        faultClaims3Y: true,
        noFaultClaims: true,
        transits: true,
        layUpMonths: true,
        insuredName: true,
        brokerName: true,
        brokerCompany: true,
        brokerEmail: true,
        createdBy: true,
        quotes: {
          where: { status: 'BOUND' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { validUntil: true }
        }
      }
    });

    for (const submission of candidates) {
      const inserted = await prisma.$transaction(async (tx) => {
        const created = await markRenewalNotified(
          tx as Prisma.TransactionClient,
          submission.tenantId,
          submission.id,
          daysBefore
        );

        if (!created) return null;

        const renewalDraftId = await ensureRenewalDraft(
          tx as Prisma.TransactionClient,
          submission
        );

        return renewalDraftId;
      });

      if (!inserted) continue;

      if (submission.brokerEmail) {
        const expiry = submission.quotes[0]?.validUntil;

        await enqueueUnderwritingSlipEmailJob({
          tenantId: submission.tenantId,
          submissionId: submission.id,
          to: submission.brokerEmail,
          subject: `Renewal Reminder (${daysBefore} days) — ${submission.policyNumber ?? submission.reference}`,
          text: [
            `Dear ${submission.brokerName || 'Broker'},`,
            '',
            `Policy ${submission.policyNumber ?? submission.reference} expires on ${
              expiry ? new Date(expiry).toLocaleDateString('en-GB') : 'N/A'
            } (${daysBefore} days remaining).`,
            'A prefilled renewal submission has been created in the platform.',
            '',
            'Regards,',
            'Sun Underwriting'
          ].join('\n'),
          dedupeKey: `renewal:${submission.id}:${daysBefore}`
        });
      }
    }
  }
}
