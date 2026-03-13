import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

function genEndorsementNo() {
  const year = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return `END-${year}-${rnd}`;
}

const ALLOWED_TYPES = [
  'VESSEL_CHANGE',
  'NAVIGATION_EXT',
  'LAYUP_CHANGE',
  'ADDITIONAL_INSURED'
] as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const { id } = await context.params;

      const submission = await prisma.submission.findFirst({
        where: { id, tenantId: user.tenantId, deleted: false },
        select: { id: true }
      });

      if (!submission) {
        return apiResponse({ error: 'Submission not found' }, 404 as never);
      }

      const endorsements = await prisma.policyEndorsement.findMany({
        where: { tenantId: user.tenantId, submissionId: id },
        orderBy: { createdAt: 'desc' }
      });

      return apiResponse({ endorsements });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const { id } = await context.params;
      const body = await request.json();

      const type = body?.type as (typeof ALLOWED_TYPES)[number] | undefined;
      const effectiveDate = body?.effectiveDate as string | undefined;
      const changes = (body?.changes ?? {}) as Record<string, unknown>;
      const premiumDelta =
        body?.premiumDelta !== undefined ? Number(body.premiumDelta) : null;
      const notes = body?.notes ? String(body.notes) : null;

      if (!type || !ALLOWED_TYPES.includes(type)) {
        return apiResponse({ error: 'Invalid endorsement type' }, 400 as never);
      }

      if (!effectiveDate) {
        return apiResponse(
          { error: 'effectiveDate is required' },
          400 as never
        );
      }

      const submission = await prisma.submission.findFirst({
        where: { id, tenantId: user.tenantId, deleted: false },
        select: { id: true }
      });

      if (!submission) {
        return apiResponse({ error: 'Submission not found' }, 404 as never);
      }

      const endorsement = await prisma.policyEndorsement.create({
        data: {
          tenantId: user.tenantId,
          submissionId: id,
          endorsementNo: genEndorsementNo(),
          type,
          status: 'PENDING',
          effectiveDate: new Date(effectiveDate),
          changes: changes as object,
          premiumDelta,
          notes,
          createdBy: user.id
        }
      });

      return apiResponse({ endorsement }, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
