'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  UserCheck,
  AlertCircle,
  MessageSquare,
  AtSign,
  TrendingUp,
  Users,
  Clock,
  Bell,
  Mail,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NotificationPref {
  notificationType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

interface PrefSection {
  label: string;
  description: string;
  icon: React.ElementType;
  events: {
    type: string;
    label: string;
    description: string;
  }[];
}

const SECTIONS: PrefSection[] = [
  {
    label: 'Activities',
    description: 'Reminders and updates about your tasks and meetings',
    icon: Calendar,
    events: [
      {
        type: 'crm.activity.assigned',
        label: 'Activity assigned',
        description: 'When someone assigns an activity to you',
      },
      {
        type: 'crm.activity.due_soon',
        label: 'Activity due soon',
        description: 'Reminder before an activity is due',
      },
      {
        type: 'crm.activity.overdue',
        label: 'Activity overdue',
        description: 'When a past-due activity hasn\'t been completed',
      },
      {
        type: 'crm.activity.rescheduled',
        label: 'Activity rescheduled',
        description: 'When someone changes the due date of your activity',
      },
    ],
  },
  {
    label: 'Deals',
    description: 'Progress updates and status changes on deals',
    icon: TrendingUp,
    events: [
      {
        type: 'crm.deal.stage_changed',
        label: 'Stage changed',
        description: 'When a deal you own moves to a new stage',
      },
      {
        type: 'crm.deal.won',
        label: 'Deal won',
        description: 'When a deal is marked as won',
      },
      {
        type: 'crm.deal.lost',
        label: 'Deal lost',
        description: 'When a deal is marked as lost',
      },
      {
        type: 'crm.deal.rotten',
        label: 'Deal stuck',
        description: 'When a deal has been idle too long',
      },
    ],
  },
  {
    label: 'Leads',
    description: 'Notifications about lead assignments and conversions',
    icon: Users,
    events: [
      {
        type: 'crm.lead.assigned',
        label: 'Lead assigned',
        description: 'When a lead is assigned to you',
      },
      {
        type: 'crm.lead.converted',
        label: 'Lead converted',
        description: 'When a lead you own is converted to a deal',
      },
    ],
  },
  {
    label: 'Comments & Mentions',
    description: 'Interactions with your CRM records',
    icon: MessageSquare,
    events: [
      {
        type: 'crm.comment.created',
        label: 'New comment',
        description: 'When someone comments on a record you own',
      },
      {
        type: 'crm.mention.created',
        label: 'Mention',
        description: 'When someone @mentions you in a comment',
      },
    ],
  },
];

// ─── Row component ─────────────────────────────────────────────────────────────
function PrefRow({
  event,
  pref,
  onToggle,
}: {
  event: PrefSection['events'][number];
  pref: NotificationPref;
  onToggle: (type: string, channel: 'inApp' | 'email', value: boolean) => void;
}) {
  return (
    <div className='flex items-center justify-between gap-4 py-3'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium'>{event.label}</p>
        <p className='text-xs text-muted-foreground'>{event.description}</p>
      </div>
      <div className='flex items-center gap-6'>
        <div className='flex items-center gap-2'>
          <Bell className='h-3.5 w-3.5 text-muted-foreground' />
          <Switch
            checked={pref.inAppEnabled}
            onCheckedChange={(v) => onToggle(event.type, 'inApp', v)}
            aria-label={`In-app notification for ${event.label}`}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Mail className='h-3.5 w-3.5 text-muted-foreground' />
          <Switch
            checked={pref.emailEnabled}
            onCheckedChange={(v) => onToggle(event.type, 'email', v)}
            aria-label={`Email notification for ${event.label}`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Map<string, NotificationPref>>(new Map());
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const fetchPrefs = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch('/api/notifications/preferences');
      if (!res.ok) throw new Error('Failed to load preferences');
      const { data } = await res.json();
      const map = new Map<string, NotificationPref>();
      for (const p of data.preferences as NotificationPref[]) {
        map.set(p.notificationType, p);
      }
      setPrefs(map);
    } catch {
      toast.error('Failed to load notification preferences');
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  function handleToggle(type: string, channel: 'inApp' | 'email', value: boolean) {
    setPrefs((prev) => {
      const map = new Map(prev);
      const current = map.get(type) ?? { notificationType: type, inAppEnabled: true, emailEnabled: false };
      map.set(type, {
        ...current,
        ...(channel === 'inApp' ? { inAppEnabled: value } : { emailEnabled: value }),
      });
      return map;
    });
    setDirty((prev) => new Set([...prev, type]));
  }

  async function handleSave() {
    const changedPrefs = Array.from(dirty).map((type) => {
      const p = prefs.get(type) ?? { notificationType: type, inAppEnabled: true, emailEnabled: false };
      return {
        notificationType: p.notificationType,
        inAppEnabled: p.inAppEnabled,
        emailEnabled: p.emailEnabled,
      };
    });

    if (changedPrefs.length === 0) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: changedPrefs }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setDirty(new Set());
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  }

  if (isFetching) {
    return (
      <div className='flex items-center justify-center py-24'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      {/* Column headers */}
      <div className='flex items-center justify-end gap-6 pr-1 text-xs font-medium text-muted-foreground'>
        <div className='flex items-center gap-1.5'>
          <Bell className='h-3.5 w-3.5' />
          In-app
        </div>
        <div className='flex items-center gap-1.5'>
          <Mail className='h-3.5 w-3.5' />
          Email
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const SectionIcon = section.icon;
        return (
          <div key={section.label} className='space-y-1'>
            <div className='flex items-center gap-2.5'>
              <div className='flex h-8 w-8 items-center justify-center rounded-md bg-muted'>
                <SectionIcon className='h-4 w-4 text-muted-foreground' />
              </div>
              <div>
                <h3 className='text-sm font-semibold'>{section.label}</h3>
                <p className='text-xs text-muted-foreground'>{section.description}</p>
              </div>
            </div>
            <div className={cn('rounded-lg border divide-y')}>
              {section.events.map((event) => {
                const pref = prefs.get(event.type) ?? {
                  notificationType: event.type,
                  inAppEnabled: true,
                  emailEnabled: false,
                };
                return (
                  <div key={event.type} className='px-4'>
                    <PrefRow event={event} pref={pref} onToggle={handleToggle} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Save bar */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t bg-background/95 px-6 py-3 shadow-md backdrop-blur transition-transform',
          dirty.size > 0 ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <p className='text-sm text-muted-foreground'>
          You have unsaved changes ({dirty.size} {dirty.size === 1 ? 'item' : 'items'})
        </p>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              fetchPrefs();
              setDirty(new Set());
            }}
          >
            Discard
          </Button>
          <Button size='sm' onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
