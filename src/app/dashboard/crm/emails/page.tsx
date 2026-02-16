'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { IconPlus, IconSearch, IconInbox, IconSend } from '@tabler/icons-react';
import { useEmails } from '@/features/crm/emails/hooks/use-emails';
import { useDebounce } from '@/hooks/use-debounce';
import { format } from 'date-fns';
import type { PaginationState } from '@tanstack/react-table';

/**
 * Emails Page
 * Placeholder UI for future IMAP/SMTP integration
 */
export default function EmailsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [directionFilter, setDirectionFilter] = useState<
    'all' | 'INCOMING' | 'OUTGOING'
  >('all');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20
  });

  const { data, isLoading, error } = useEmails({
    direction: directionFilter === 'all' ? undefined : directionFilter,
    search: debouncedSearch,
    skip: pagination.pageIndex * pagination.pageSize,
    take: pagination.pageSize
  });

  const emails = data?.emails || [];

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>Emails</h2>
          <p className='text-muted-foreground'>
            Email communication hub (Mock version - IMAP/SMTP integration
            pending)
          </p>
        </div>
        <Button disabled>
          <IconPlus className='mr-2 h-4 w-4' />
          Compose (Coming Soon)
        </Button>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Emails</CardTitle>
            <IconInbox className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data?.total || 0}</div>
            <p className='text-muted-foreground text-xs'>All conversations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Received</CardTitle>
            <IconInbox className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {emails.filter((e) => e.direction === 'INCOMING').length}
            </div>
            <p className='text-muted-foreground text-xs'>Inbound emails</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Sent</CardTitle>
            <IconSend className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {emails.filter((e) => e.direction === 'OUTGOING').length}
            </div>
            <p className='text-muted-foreground text-xs'>Outbound emails</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Email History</CardTitle>
              <CardDescription>
                View past email communications (Mock data for demonstration)
              </CardDescription>
            </div>
            <div className='relative w-72'>
              <IconSearch className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder='Search emails...'
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination({ ...pagination, pageIndex: 0 });
                }}
                className='pl-9'
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-2'>
              {[...Array(5)].map((_, i) => (
                <div key={i} className='bg-muted h-20 animate-pulse rounded' />
              ))}
            </div>
          ) : error ? (
            <div className='text-destructive py-12 text-center'>
              {error instanceof Error ? error.message : 'Failed to load emails'}
            </div>
          ) : emails.length === 0 ? (
            <div className='text-muted-foreground py-12 text-center'>
              <IconInbox className='mx-auto mb-4 h-12 w-12 opacity-50' />
              <p>No emails found</p>
              <p className='mt-2 text-sm'>
                Email integration with IMAP/SMTP is coming soon
              </p>
            </div>
          ) : (
            <div className='space-y-2'>
              {emails.map((email) => {
                const isInbound = email.direction === 'INCOMING';
                return (
                  <div
                    key={email.id}
                    className='hover:bg-muted/50 flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors'
                  >
                    <div className='mt-1 flex-shrink-0'>
                      {isInbound ? (
                        <IconInbox className='h-5 w-5 text-blue-500' />
                      ) : (
                        <IconSend className='h-5 w-5 text-green-500' />
                      )}
                    </div>
                    <div className='flex-1 space-y-1'>
                      <div className='flex items-center justify-between'>
                        <div className='font-medium'>{email.subject}</div>
                        <Badge variant={isInbound ? 'default' : 'secondary'}>
                          {isInbound ? 'Received' : 'Sent'}
                        </Badge>
                      </div>
                      <div className='text-muted-foreground text-sm'>
                        {isInbound ? `From: ${email.from}` : `To: ${email.to}`}
                      </div>
                      {email.bodyPreview && (
                        <div className='text-muted-foreground line-clamp-2 text-sm'>
                          {email.bodyPreview}
                        </div>
                      )}
                      <div className='text-muted-foreground text-xs'>
                        {email.sentAt &&
                          format(new Date(email.sentAt), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {emails.length > 0 && (
            <div className='mt-4 flex items-center justify-center border-t pt-4'>
              <p className='text-muted-foreground text-sm'>
                Showing {emails.length} of {data?.total || 0} emails
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
