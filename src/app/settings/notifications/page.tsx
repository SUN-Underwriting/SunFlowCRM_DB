import { NotificationPreferencesPage } from '@/features/notifications/components/notification-preferences';

export const metadata = {
  title: 'Settings: Notifications',
};

export default function NotificationSettingsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-xl font-semibold'>Notification preferences</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Choose how and when you receive notifications. Email notifications are off by default.
        </p>
      </div>
      <NotificationPreferencesPage />
    </div>
  );
}
