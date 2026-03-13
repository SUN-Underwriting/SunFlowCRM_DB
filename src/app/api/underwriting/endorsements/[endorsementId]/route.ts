import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

const ALLOWED_STATUSES = [
  'PENDING',
  'APPROVED',
  'APPLIED',
  'DECLINED'
] as const;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ endorsementId: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const { endorsementId } = await context.params;
      const body = await request.json();
      const status = body?.status as
        | (typeof ALLOWED_STATUSES)[number]
        | undefined;
      const notes = body?.notes !== undefined ? String(body.notes) : undefined;

      if (status && !ALLOWED_STATUSES.includes(status)) {
        return apiResponse(
          { error: 'Invalid endorsement status' },
          400 as never
        );
      }

      const endorsement = await prisma.policyEndorsement.findFirst({
        where: { id: endorsementId, tenantId: user.tenantId },
        include: { submission: true }
      });

      if (!endorsement) {
        return apiResponse({ error: 'Endorsement not found' }, 404 as never);
      }

      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.policyEndorsement.update({
          where: { id: endorsement.id },
          data: {
            ...(status && { status }),
            ...(notes !== undefined && { notes })
          }
        });

        if (status === 'APPLIED') {
          const changes = asObject(endorsement.changes);
          const submissionPatch: Record<string, unknown> = {};

          if (endorsement.type === 'VESSEL_CHANGE') {
            if (changes.vesselName)
              submissionPatch.vesselName = String(changes.vesselName);
            if (changes.yearBuilt)
              submissionPatch.yearBuilt = Number(changes.yearBuilt);
            if (changes.lengthFeet)
              submissionPatch.lengthFeet = Number(changes.lengthFeet);
            if (changes.hullValue)
              submissionPatch.hullValue = Number(changes.hullValue);
          }

          if (endorsement.type === 'NAVIGATION_EXT') {
            if (changes.navigationArea)
              submissionPatch.navigationArea = String(changes.navigationArea);
            if (changes.navAreaModifier)
              submissionPatch.navAreaModifier = String(changes.navAreaModifier);
          }

          if (endorsement.type === 'LAYUP_CHANGE') {
            if (changes.layUpMonths !== undefined) {
              submissionPatch.layUpMonths = Number(changes.layUpMonths);
            }
          }

          if (endorsement.type === 'ADDITIONAL_INSURED') {
            const existing = endorsement.submission.uwNotes ?? '';
            const addText = String(changes.additionalInsured ?? '').trim();
            if (addText) {
              submissionPatch.uwNotes = `${existing}${existing ? '\n\n' : ''}[Endorsement ${endorsement.endorsementNo}] Additional insured: ${addText}`;
            }
          }

          if (Object.keys(submissionPatch).length > 0) {
            await tx.submission.update({
              where: { id: endorsement.submissionId },
              data: submissionPatch
            });
          }

          if (endorsement.premiumDelta !== null) {
            const latestQuote = await tx.quote.findFirst({
              where: { submissionId: endorsement.submissionId },
              orderBy: { createdAt: 'desc' }
            });
            if (latestQuote) {
              await tx.quote.update({
                where: { id: latestQuote.id },
                data: {
                  totalPremium:
                    Number(latestQuote.totalPremium) +
                    Number(endorsement.premiumDelta)
                }
              });
            }
          }
        }

        return next;
      });

      return apiResponse({ endorsement: updated });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
