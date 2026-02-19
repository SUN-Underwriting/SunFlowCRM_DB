/**
 * Notification Template Registry — inspired by Novu's workflow/template model.
 *
 * Templates are keyed by `{eventType}:{channel}` so we can support different
 * copy per delivery channel (in-app vs email) without a database engine.
 *
 * v1: plain TypeScript map.
 * v2: consider DB-backed templates with versioning and tenant overrides.
 */
import { NotificationEventType } from './types';

export type NotificationChannel = 'in_app' | 'email';

interface NotificationTemplate {
  /** Short title shown in bell dropdown / email subject line. */
  title: string;
  /** Body text with {{placeholder}} interpolation. */
  body: string;
  /** Declared variable names — useful for validation and docs. */
  variables: string[];
}

/** key = `${eventType}:${channel}` */
const templates: Record<string, NotificationTemplate> = {
  // ─── Activity: in-app ──────────────────────────────────────────────────────
  [`${NotificationEventType.ACTIVITY_ASSIGNED}:in_app`]: {
    title: 'New activity assigned',
    body: '{{actorName}} assigned you "{{activitySubject}}" for {{dueAt}}{{entityName}}',
    variables: ['actorName', 'activitySubject', 'dueAt', 'entityName'],
  },
  [`${NotificationEventType.ACTIVITY_DUE_SOON}:in_app`]: {
    title: 'Activity due soon',
    body: '"{{activitySubject}}" is due at {{dueAt}}{{entityName}}',
    variables: ['activitySubject', 'dueAt', 'entityName'],
  },
  [`${NotificationEventType.ACTIVITY_OVERDUE}:in_app`]: {
    title: 'Activity overdue',
    body: '"{{activitySubject}}" was due {{dueAt}} ({{daysOverdue}} days ago){{entityName}}',
    variables: ['activitySubject', 'dueAt', 'daysOverdue', 'entityName'],
  },
  [`${NotificationEventType.ACTIVITY_RESCHEDULED}:in_app`]: {
    title: 'Activity rescheduled',
    body: '{{actorName}} moved "{{activitySubject}}" to {{dueAt}}{{entityName}}',
    variables: ['actorName', 'activitySubject', 'dueAt', 'entityName'],
  },

  // ─── Activity: email ───────────────────────────────────────────────────────
  [`${NotificationEventType.ACTIVITY_ASSIGNED}:email`]: {
    title: 'New activity assigned: "{{activitySubject}}"',
    body: '{{actorName}} has assigned you an activity "{{activitySubject}}" due {{dueAt}}{{entityName}}.\n\nOpen CRM to view it.',
    variables: ['actorName', 'activitySubject', 'dueAt', 'entityName'],
  },
  [`${NotificationEventType.ACTIVITY_DUE_SOON}:email`]: {
    title: 'Reminder: "{{activitySubject}}" is due soon',
    body: 'Your activity "{{activitySubject}}" is due at {{dueAt}}{{entityName}}.\n\nOpen CRM to view it.',
    variables: ['activitySubject', 'dueAt', 'entityName'],
  },
  [`${NotificationEventType.ACTIVITY_OVERDUE}:email`]: {
    title: 'Overdue activity: "{{activitySubject}}"',
    body: 'Your activity "{{activitySubject}}" was due {{dueAt}} ({{daysOverdue}} days ago){{entityName}}.\n\nPlease action it in CRM.',
    variables: ['activitySubject', 'dueAt', 'daysOverdue', 'entityName'],
  },
  [`${NotificationEventType.ACTIVITY_RESCHEDULED}:email`]: {
    title: 'Activity rescheduled: "{{activitySubject}}"',
    body: '{{actorName}} rescheduled your activity "{{activitySubject}}" to {{dueAt}}{{entityName}}.',
    variables: ['actorName', 'activitySubject', 'dueAt', 'entityName'],
  },

  // ─── Deal: in-app ──────────────────────────────────────────────────────────
  [`${NotificationEventType.DEAL_STAGE_CHANGED}:in_app`]: {
    title: 'Deal moved',
    body: '{{actorName}} moved "{{dealTitle}}" to {{stageName}}',
    variables: ['actorName', 'dealTitle', 'stageName'],
  },
  [`${NotificationEventType.DEAL_WON}:in_app`]: {
    title: 'Deal won!',
    body: '"{{dealTitle}}" was marked as won',
    variables: ['dealTitle'],
  },
  [`${NotificationEventType.DEAL_LOST}:in_app`]: {
    title: 'Deal lost',
    body: '"{{dealTitle}}" was marked as lost',
    variables: ['dealTitle'],
  },
  [`${NotificationEventType.DEAL_ROTTEN}:in_app`]: {
    title: 'Deal stuck',
    body: '"{{dealTitle}}" has been idle too long',
    variables: ['dealTitle'],
  },

  // ─── Deal: email ───────────────────────────────────────────────────────────
  [`${NotificationEventType.DEAL_STAGE_CHANGED}:email`]: {
    title: 'Deal update: "{{dealTitle}}" moved to {{stageName}}',
    body: '{{actorName}} moved deal "{{dealTitle}}" to the {{stageName}} stage.',
    variables: ['actorName', 'dealTitle', 'stageName'],
  },
  [`${NotificationEventType.DEAL_WON}:email`]: {
    title: 'Deal won: "{{dealTitle}}"',
    body: 'Great news! Deal "{{dealTitle}}" has been marked as won.',
    variables: ['dealTitle'],
  },
  [`${NotificationEventType.DEAL_LOST}:email`]: {
    title: 'Deal lost: "{{dealTitle}}"',
    body: 'Deal "{{dealTitle}}" has been marked as lost.',
    variables: ['dealTitle'],
  },

  // ─── Lead: in-app ──────────────────────────────────────────────────────────
  [`${NotificationEventType.LEAD_ASSIGNED}:in_app`]: {
    title: 'Lead assigned to you',
    body: '{{actorName}} assigned you lead "{{leadTitle}}"',
    variables: ['actorName', 'leadTitle'],
  },
  [`${NotificationEventType.LEAD_CONVERTED}:in_app`]: {
    title: 'Lead converted',
    body: '"{{leadTitle}}" was converted to a deal',
    variables: ['leadTitle'],
  },

  // ─── Lead: email ───────────────────────────────────────────────────────────
  [`${NotificationEventType.LEAD_ASSIGNED}:email`]: {
    title: 'Lead assigned to you: "{{leadTitle}}"',
    body: '{{actorName}} has assigned lead "{{leadTitle}}" to you.',
    variables: ['actorName', 'leadTitle'],
  },
  [`${NotificationEventType.LEAD_CONVERTED}:email`]: {
    title: 'Lead converted: "{{leadTitle}}"',
    body: 'Lead "{{leadTitle}}" has been converted to a deal.',
    variables: ['leadTitle'],
  },

  // ─── Comments: in-app ──────────────────────────────────────────────────────
  [`${NotificationEventType.COMMENT_CREATED}:in_app`]: {
    title: 'New comment',
    body: '{{actorName}} commented on {{entityKind}} "{{entityTitle}}"',
    variables: ['actorName', 'entityKind', 'entityTitle'],
  },
  [`${NotificationEventType.MENTION_CREATED}:in_app`]: {
    title: 'You were mentioned',
    body: '{{actorName}} mentioned you in {{entityKind}} "{{entityTitle}}"',
    variables: ['actorName', 'entityKind', 'entityTitle'],
  },

  // ─── Comments: email ───────────────────────────────────────────────────────
  [`${NotificationEventType.COMMENT_CREATED}:email`]: {
    title: 'New comment on {{entityKind}} "{{entityTitle}}"',
    body: '{{actorName}} left a comment on {{entityKind}} "{{entityTitle}}".',
    variables: ['actorName', 'entityKind', 'entityTitle'],
  },
  [`${NotificationEventType.MENTION_CREATED}:email`]: {
    title: '{{actorName}} mentioned you',
    body: '{{actorName}} mentioned you in a comment on {{entityKind}} "{{entityTitle}}".',
    variables: ['actorName', 'entityKind', 'entityTitle'],
  },
};

/**
 * Render a notification template for a given event type and channel.
 * Falls back to in_app template if no email variant is registered.
 * Returns raw type string and empty body if no template exists.
 */
export function renderTemplate(
  type: string,
  channel: NotificationChannel = 'in_app',
  vars: Record<string, unknown>
): { title: string; body: string } {
  const key = `${type}:${channel}`;
  const fallbackKey = `${type}:in_app`;
  const tpl = templates[key] ?? templates[fallbackKey] ?? { title: type, body: '' };

  const interpolate = (str: string): string =>
    str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));

  return {
    title: interpolate(tpl.title),
    body: interpolate(tpl.body),
  };
}

/**
 * Get the declared variable names for a template.
 * Useful for validation in tests.
 */
export function getTemplateVariables(
  type: string,
  channel: NotificationChannel = 'in_app'
): string[] {
  return templates[`${type}:${channel}`]?.variables ?? [];
}
