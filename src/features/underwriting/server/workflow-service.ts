import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError
} from '@/lib/errors/app-errors';
import { buildPolicyCertificateBuffer } from '@/features/underwriting/server/documents';

interface BindInput {
  tenantId: string;
  submissionId: string;
  actorUserId: string;
}

export interface UnderwritingSummary {
  id: string;
  tenantId: string;
  status: string;
  reference: string;
  policyNumber: string | null;
  policyIssuedAt: Date | null;
  boundAt: Date | null;
  policyDocumentGeneratedAt: Date | null;
  quotes: Array<{
    id: string;
    status: string;
    uwFlags: Prisma.JsonValue;
    autoDecline: string | null;
    validFrom: Date | null;
    validUntil: Date | null;
  }>;
}

const CANNOT_BIND_PATTERN = /CANNOT BIND/i;

export function extractUwFlags(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export function hasBindBlockers(quote: {
  autoDecline: string | null;
  uwFlags: Prisma.JsonValue;
}) {
  const flags = extractUwFlags(quote.uwFlags);
  const hasCannotBindFlag = flags.some((f) => CANNOT_BIND_PATTERN.test(f));

  return {
    flags,
    hasCannotBindFlag,
    blocked: Boolean(quote.autoDecline) || hasCannotBindFlag,
    reason:
      quote.autoDecline ??
      (hasCannotBindFlag
        ? (flags.find((f) => CANNOT_BIND_PATTERN.test(f)) ??
          'Cannot bind due to underwriting blocker flags')
        : null)
  };
}

async function nextPolicyNumberTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "policy_sequences" ("id", "tenantId", "year", "lastValue", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${tenantId}, ${year}, 1, NOW(), NOW())
    ON CONFLICT ("tenantId", "year")
    DO UPDATE
      SET "lastValue" = "policy_sequences"."lastValue" + 1,
          "updatedAt" = NOW()
    RETURNING "lastValue";
  `;

  const sequence = rows[0]?.lastValue ?? 1;
  const padded = String(sequence).padStart(5, '0');
  return `SUN-POL-${year}-${padded}`;
}

export async function bindSubmissionWorkflow(
  input: BindInput
): Promise<UnderwritingSummary> {
  const { tenantId, submissionId } = input;

  const now = new Date();
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, tenantId, deleted: false },
    include: {
      quotes: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });

  if (!submission) {
    throw new NotFoundError('Submission not found');
  }

  const latestQuote = submission.quotes[0];
  if (!latestQuote) {
    throw new BusinessRuleError('Cannot bind submission without quote');
  }

  const blockers = hasBindBlockers({
    autoDecline: latestQuote.autoDecline,
    uwFlags: latestQuote.uwFlags
  });

  if (blockers.blocked) {
    throw new ConflictError(
      `Bind blocked by underwriting rules: ${blockers.reason ?? 'unknown blocker'}`
    );
  }

  if (['DECLINED', 'EXPIRED'].includes(submission.status)) {
    throw new ConflictError(
      `Cannot bind submission in status ${submission.status}`
    );
  }

  if (submission.status === 'POLICY_ISSUED') {
    throw new ConflictError('Policy already issued for this submission');
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentYear = now.getFullYear();
    const policyNumber =
      submission.policyNumber ??
      (await nextPolicyNumberTx(
        tx as Prisma.TransactionClient,
        tenantId,
        currentYear
      ));

    const validFrom = latestQuote.validFrom ?? now;
    const validUntil =
      latestQuote.validUntil ??
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await tx.quote.update({
      where: { id: latestQuote.id },
      data: {
        status: 'BOUND',
        validFrom,
        validUntil,
        approvedBy: input.actorUserId,
        approvedAt: now
      }
    });

    // Keep explicit BOUND transition semantics before final issuance state.
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: 'BOUND',
        boundAt: now,
        policyNumber
      }
    });

    const updated = await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: 'POLICY_ISSUED' as never,
        policyNumber,
        policyIssuedAt: now,
        policyDocumentGeneratedAt: now,
        policyDocumentPath: `generated://policy/${policyNumber}`
      },
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            uwFlags: true,
            autoDecline: true,
            validFrom: true,
            validUntil: true
          }
        }
      }
    });

    return updated;
  });

  const latest = result.quotes[0] ?? null;
  const certBuffer = await buildPolicyCertificateBuffer(
    {
      reference: result.reference,
      policyNumber: result.policyNumber,
      vesselName: submission.vesselName,
      territory: submission.territory,
      useType: submission.useType
    },
    latest
      ? {
          quoteNumber: latest.id,
          totalPremium: null,
          validFrom: latest.validFrom,
          validUntil: latest.validUntil
        }
      : null
  );

  await prisma.submission.update({
    where: { id: result.id },
    data: {
      policyDocumentPath: `generated://policy/${result.policyNumber ?? result.reference}?bytes=${certBuffer.length}`,
      policyDocumentGeneratedAt: new Date()
    }
  });

  return {
    id: result.id,
    tenantId: result.tenantId,
    status: result.status,
    reference: result.reference,
    policyNumber: result.policyNumber,
    policyIssuedAt: result.policyIssuedAt,
    boundAt: result.boundAt,
    policyDocumentGeneratedAt: result.policyDocumentGeneratedAt,
    quotes: result.quotes
  };
}
