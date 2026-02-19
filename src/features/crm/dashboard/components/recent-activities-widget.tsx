'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  IconPhone,
  IconMail,
  IconCalendar,
  IconNotes,
  IconAlarm,
  IconToolsKitchen2
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import type { ActivityType } from '@prisma/client';

interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  createdAt: Date;
  owner?: {
    firstName: string;
    lastName: string;
  };
}

interface RecentActivitiesWidgetProps {
  activities: Activity[];
  isLoading?: boolean;
}

const activityIcons: Record<ActivityType, any> = {
  CALL: IconPhone,
  EMAIL: IconMail,
  MEETING: IconCalendar,
  TASK: IconNotes,
  DEADLINE: IconAlarm,
  LUNCH: IconToolsKitchen2
};

const activityColors: Record<ActivityType, string> = {
  CALL: 'bg-blue-500/10 text-blue-700 border-blue-200',
  EMAIL: 'bg-purple-500/10 text-purple-700 border-purple-200',
  MEETING: 'bg-green-500/10 text-green-700 border-green-200',
  TASK: 'bg-orange-500/10 text-orange-700 border-orange-200',
  DEADLINE: 'bg-red-500/10 text-red-700 border-red-200',
  LUNCH: 'bg-yellow-500/10 text-yellow-700 border-yellow-200'
};

/**
 * Recent Activities Widget
 * Best Practice: Real-time activity feed for dashboard
 */
export function RecentActivitiesWidget({
  activities,
  isLoading
}: RecentActivitiesWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Latest team activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='flex items-start gap-4'>
                <div className='bg-muted h-8 w-8 animate-pulse rounded-full' />
                <div className='flex-1 space-y-2'>
                  <div className='bg-muted h-4 w-3/4 animate-pulse rounded' />
                  <div className='bg-muted h-3 w-1/2 animate-pulse rounded' />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
        <CardDescription>Latest team activities</CardDescription>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <div className='text-muted-foreground py-8 text-center'>
            No recent activities
          </div>
        ) : (
          <div className='space-y-4'>
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type];
              const colorClass = activityColors[activity.type];
              const ownerInitials = activity.owner
                ? `${activity.owner.firstName[0]}${activity.owner.lastName[0]}`.toUpperCase()
                : '?';

              return (
                <div key={activity.id} className='flex items-start gap-4'>
                  <Avatar className='h-8 w-8'>
                    <AvatarFallback className='text-xs'>
                      {ownerInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex-1 space-y-1'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className={colorClass}>
                        <Icon className='mr-1 h-3 w-3' />
                        {activity.type}
                      </Badge>
                    </div>
                    <p className='text-sm font-medium'>{activity.subject}</p>
                    <p className='text-muted-foreground text-xs'>
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
