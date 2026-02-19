import { NotificationEventType } from './types';

interface NotificationTemplate {
  title: string;
  body: string;
}

const templates: Record<string, NotificationTemplate> = {
  [NotificationEventType.ACTIVITY_ASSIGNED]: {
    title: 'Activity assigned to you',
    body: '{{actorName}} assigned you "{{activitySubject}}"',
  },
  [NotificationEventType.ACTIVITY_DUE_SOON]: {
    title: 'Activity due soon',
    body: '"{{activitySubject}}" is due at {{dueAt}}',
  },
  [NotificationEventType.ACTIVITY_OVERDUE]: {
    title: 'Activity overdue',
    body: '"{{activitySubject}}" was due at {{dueAt}}',
  },
  [NotificationEventType.DEAL_STAGE_CHANGED]: {
    title: 'Deal moved',
    body: '{{actorName}} moved "{{dealTitle}}" to {{stageName}}',
  },
  [NotificationEventType.DEAL_WON]: {
    title: 'Deal won!',
    body: '"{{dealTitle}}" was marked as won',
  },
  [NotificationEventType.DEAL_LOST]: {
    title: 'Deal lost',
    body: '"{{dealTitle}}" was marked as lost',
  },
  [NotificationEventType.DEAL_ROTTEN]: {
    title: 'Deal stuck',
    body: '"{{dealTitle}}" has been idle too long',
  },
  [NotificationEventType.LEAD_ASSIGNED]: {
    title: 'Lead assigned to you',
    body: '{{actorName}} assigned you lead "{{leadTitle}}"',
  },
  [NotificationEventType.LEAD_CONVERTED]: {
    title: 'Lead converted',
    body: '"{{leadTitle}}" was converted to a deal',
  },
  [NotificationEventType.COMMENT_CREATED]: {
    title: 'New comment',
    body: '{{actorName}} commented on {{entityKind}}',
  },
  [NotificationEventType.MENTION_CREATED]: {
    title: 'You were mentioned',
    body: '{{actorName}} mentioned you in a {{entityKind}}',
  },
};

/**
 * Render a notification template by replacing {{placeholder}} tokens.
 * Returns the raw template strings if type is unknown.
 */
export function renderTemplate(
  type: string,
  vars: Record<string, unknown>
): { title: string; body: string } {
  const tpl = templates[type] ?? { title: type, body: '' };

  const interpolate = (str: string): string =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));

  return {
    title: interpolate(tpl.title),
    body: interpolate(tpl.body),
  };
}
