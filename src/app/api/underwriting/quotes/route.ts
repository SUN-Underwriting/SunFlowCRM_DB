import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const quotes = await prisma.quote.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          submission: {
            select: {
              id: true,
              reference: true,
              vesselName: true,
              hullValue: true,
              territory: true,
              status: true
            }
          }
        }
      });

      return apiResponse({ quotes });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
