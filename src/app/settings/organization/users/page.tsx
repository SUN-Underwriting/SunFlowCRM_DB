'use client';

import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { UsersTable } from '@/features/settings/components/users/users-table';
import { InviteUserDialog } from '@/features/settings/components/users/invite-user-dialog';

export default function UsersPage() {
  return (
    <PageContainer>
      <div className='space-y-4'>
        <div className='flex items-start justify-between'>
          <Heading
            title='Users'
            description='Manage users, roles, and access invitations for your organization.'
          />
          <InviteUserDialog />
        </div>
        <Separator />

        <UsersTable />
      </div>
    </PageContainer>
  );
}
