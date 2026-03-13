import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

type Range = 'month' | 'quarter' | 'year';

function getRangeStart(now: Date, range: Range): Date {
  if (range === 'year') {
    return new Date(now.getFullYear(), 0, 1);
  }
  if (range === 'quarter') {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), qStartMonth, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const search = request.nextUrl.searchParams;
      const rangeParam = search.get('range');
      const range: Range =
        rangeParam === 'quarter' || rangeParam === 'year'
          ? rangeParam
          : 'month';

      const now = new Date();
      const start = getRangeStart(now, range);

      const [quotes, submissions] = await Promise.all([
        prisma.quote.findMany({
          where: {
            tenantId: user.tenantId,
            createdAt: { gte: start }
          },
          select: {
            id: true,
            totalPremium: true,
            status: true,
            createdAt: true,
            submissionId: true,
            submission: {
              select: {
                brokerCompany: true,
                brokerName: true,
                territory: true
              }
            }
          }
        }),
        prisma.submission.findMany({
          where: {
            tenantId: user.tenantId,
            deleted: false,
            OR: [
              { policyIssuedAt: { gte: start } },
              { boundAt: { gte: start } },
              { createdAt: { gte: start } }
            ]
          },
          select: {
            id: true,
            status: true,
            policyIssuedAt: true,
            boundAt: true
          }
        })
      ]);

      const issuedStatuses = new Set(['BOUND', 'POLICY_ISSUED']);
      const boundQuotes = quotes.filter((q) => q.status === 'BOUND');
      const quoteCount = quotes.length;
      const policyCount = submissions.filter((s) =>
        issuedStatuses.has(s.status)
      ).length;
      const conversionRate =
        quoteCount > 0 ? (policyCount / quoteCount) * 100 : 0;
      const gwp = boundQuotes.reduce(
        (sum, q) => sum + toNumber(q.totalPremium),
        0
      );

      const brokerTotals = new Map<
        string,
        { broker: string; premium: number; policies: number }
      >();

      const territoryTotals = new Map<string, number>();

      for (const quote of boundQuotes) {
        const premium = toNumber(quote.totalPremium);
        const broker =
          quote.submission.brokerCompany ||
          quote.submission.brokerName ||
          'Unknown';

        const currentBroker = brokerTotals.get(broker) ?? {
          broker,
          premium: 0,
          policies: 0
        };
        currentBroker.premium += premium;
        currentBroker.policies += 1;
        brokerTotals.set(broker, currentBroker);

        const territory = quote.submission.territory || 'UNKNOWN';
        territoryTotals.set(
          territory,
          (territoryTotals.get(territory) ?? 0) + premium
        );
      }

      const topBrokers = Array.from(brokerTotals.values())
        .sort((a, b) => b.premium - a.premium)
        .slice(0, 5);

      const territorySplit = Array.from(territoryTotals.entries())
        .map(([territory, premium]) => ({ territory, premium }))
        .sort((a, b) => b.premium - a.premium);

      return apiResponse({
        range,
        start,
        end: now,
        gwp,
        quoteCount,
        policyCount,
        conversionRate,
        topBrokers,
        territorySplit,
        // backward-compatible fields for legacy cards
        submissionsMTD: submissions.length,
        boundCount: policyCount,
        pendingReview: submissions.filter((s) => s.status === 'REVIEW').length,
        declined: submissions.filter((s) => s.status === 'DECLINED').length
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
