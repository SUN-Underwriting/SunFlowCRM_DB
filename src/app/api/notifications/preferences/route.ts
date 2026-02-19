import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { withRlsBypass } from '@/lib/db/rls-context';
import { NotificationEventType } from '@/server/notifications/types';

// z.enum requires a non-empty literal tuple — construct it at runtime
const VALID_TYPES_ARRAY = [...Object.values(NotificationEventType), '*'] as string[];
const VALID_TYPES = VALID_TYPES_ARRAY as unknown as [string, ...string[]];

const PrefItemSchema = z.object({
  notificationType: z.enum(VALID_TYPES),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});

const PutBodySchema = z.object({
  preferences: z.array(PrefItemSchema).min(1).max(50),
});

/**
 * GET /api/notifications/preferences
 *
 * Returns current user's notification preferences.
 * Missing preferences mean "use default" (in-app on, email off).
 */
export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const prefs = await withRlsBypass(() =>
        prisma.notificationPreference.findMany({
          where: { tenantId: user.tenantId, userId: user.id },
          select: {
            id: true,
            notificationType: true,
            inAppEnabled: true,
            emailEnabled: true,
          },
          orderBy: { notificationType: 'asc' },
        })
      );

      // Return prefs alongside defaults for all known types so UI has full picture
      const prefMap = new Map(prefs.map((p) => [p.notificationType, p]));
      const allTypes = [...Object.values(NotificationEventType), '*'] as string[];

      const result = allTypes.map((type) => ({
        notificationType: type,
        inAppEnabled: prefMap.get(type)?.inAppEnabled ?? true,
        emailEnabled: prefMap.get(type)?.emailEnabled ?? false,
        ...(prefMap.get(type) ? { id: prefMap.get(type)!.id } : {}),
      }));

      return apiResponse({ preferences: result });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/notifications/preferences
 *
 * Upsert notification preferences for the current user.
 * Send only the preferences you want to change.
 *
 * @example
 * PUT /api/notifications/preferences
 * { "preferences": [{ "notificationType": "crm.activity.assigned", "inAppEnabled": true, "emailEnabled": true }] }
 */
export async function PUT(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const body = await request.json();
      const { preferences } = PutBodySchema.parse(body);

      // Upsert each preference atomically
      const results = await withRlsBypass(() =>
        prisma.$transaction(
          preferences.map((pref) =>
            prisma.notificationPreference.upsert({
              where: {
                tenantId_userId_notificationType: {
                  tenantId: user.tenantId,
                  userId: user.id,
                  notificationType: pref.notificationType,
                },
              },
              create: {
                tenantId: user.tenantId,
                userId: user.id,
                notificationType: pref.notificationType,
                inAppEnabled: pref.inAppEnabled,
                emailEnabled: pref.emailEnabled,
              },
              update: {
                inAppEnabled: pref.inAppEnabled,
                emailEnabled: pref.emailEnabled,
              },
              select: {
                id: true,
                notificationType: true,
                inAppEnabled: true,
                emailEnabled: true,
              },
            })
          )
        )
      );

      return apiResponse({ preferences: results });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
