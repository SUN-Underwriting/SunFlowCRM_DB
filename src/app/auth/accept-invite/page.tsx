'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

interface InviteView {
  id: string;
  email: string;
  role: string;
  tenantName: string;
  firstName: string | null;
  lastName: string | null;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const [message, setMessage] = useState<string | null>(null);

  const verifyQuery = useQuery<{ invite: InviteView }>({
    queryKey: ['invite-verify', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(
        `/api/auth/invitations/verify?token=${encodeURIComponent(token)}`
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: 'Invite is invalid' } }));
        throw new Error(error.error?.message || 'Invite is invalid');
      }
      return response.json().then((r) => r.data);
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: 'Failed to accept invite' } }));
        throw new Error(error.error?.message || 'Failed to accept invite');
      }

      return response.json();
    },
    onSuccess: () => {
      setMessage('Invite accepted. Redirecting to sign in...');
      setTimeout(() => {
        const email = verifyQuery.data?.invite.email;
        const query = email ? `?email=${encodeURIComponent(email)}` : '';
        router.push(`/auth/sign-in${query}`);
      }, 1200);
    },
    onError: (error: Error) => {
      setMessage(error.message);
    }
  });

  if (!token) {
    return (
      <main className='mx-auto flex min-h-screen w-full max-w-xl items-center p-6'>
        <Card className='w-full'>
          <CardHeader>
            <CardTitle>Invalid invite link</CardTitle>
            <CardDescription>Invite token is missing.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/auth/sign-in')}>
              Go to Sign In
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-xl items-center p-6'>
      <Card className='w-full'>
        <CardHeader>
          <CardTitle>Organization Invite</CardTitle>
          <CardDescription>
            Accept the invitation to join your team.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          {verifyQuery.isLoading && <p>Validating invite...</p>}
          {verifyQuery.isError && (
            <p className='text-destructive'>
              {(verifyQuery.error as Error).message}
            </p>
          )}
          {verifyQuery.data?.invite && (
            <>
              <p>
                <strong>Email:</strong> {verifyQuery.data.invite.email}
              </p>
              <p>
                <strong>Organization:</strong>{' '}
                {verifyQuery.data.invite.tenantName}
              </p>
              <p>
                <strong>Role:</strong> {verifyQuery.data.invite.role}
              </p>
              <p>
                <strong>Expires:</strong>{' '}
                {new Date(verifyQuery.data.invite.expiresAt).toLocaleString()}
              </p>
            </>
          )}
          {message && <p>{message}</p>}
        </CardContent>
        <CardFooter className='flex gap-2'>
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={!verifyQuery.data?.invite || acceptMutation.isPending}
          >
            {acceptMutation.isPending ? 'Accepting...' : 'Accept Invite'}
          </Button>
          <Button
            variant='outline'
            onClick={() => router.push('/auth/sign-in')}
          >
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
