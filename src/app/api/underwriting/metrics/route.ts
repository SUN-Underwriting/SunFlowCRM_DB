import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [submissionsMTD, boundCount, pendingReview, declined, gwpAgg] =
        await Promise.all([
          // Submissions created this calendar month (any status)
          prisma.submission.count({
            where: {
              tenantId: user.tenantId,
              deleted: false,
              createdAt: { gte: monthStart }
            }
          }),
          // Bound policies
          prisma.submission.count({
            where: { tenantId: user.tenantId, deleted: false, status: 'BOUND' }
          }),
          // Pending review
          prisma.submission.count({
            where: { tenantId: user.tenantId, deleted: false, status: 'REVIEW' }
          }),
          // Declined (outside appetite)
          prisma.submission.count({
            where: {
              tenantId: user.tenantId,
              deleted: false,
              status: 'DECLINED'
            }
          }),
          // GWP: sum totalPremium from BOUND quotes
          prisma.quote.aggregate({
            where: { tenantId: user.tenantId, status: 'BOUND' },
            _sum: { totalPremium: true }
          })
        ]);

      const gwp = Number(gwpAgg._sum.totalPremium ?? 0);

      return apiResponse({
        submissionsMTD,
        boundCount,
        pendingReview,
        declined,
        gwp
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
