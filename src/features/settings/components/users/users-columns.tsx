'use client';

import { ColumnDef } from '@tanstack/react-table';
import { UserWithDetails } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { UserRole, UserStatus } from '@prisma/client';

export const columns = (
  onUpdateRole: (id: string, role: UserRole) => void,
  onUpdateStatus: (id: string, status: UserStatus) => void
): ColumnDef<UserWithDetails>[] => [
  {
    accessorKey: 'email',
    header: 'User',
    cell: ({ row }) => {
      const user = row.original;
      const initials =
        (user.firstName?.[0] || '') +
        (user.lastName?.[0] || user.email[0]).toUpperCase();

      return (
        <div className='flex items-center gap-3'>
          <Avatar className='h-8 w-8'>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className='flex flex-col'>
            <span className='text-sm font-medium'>
              {user.firstName} {user.lastName}
            </span>
            <span className='text-muted-foreground text-xs'>{user.email}</span>
          </div>
        </div>
      );
    }
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
      const role = row.getValue('role') as UserRole;
      const variants: Record<
        UserRole,
        'default' | 'secondary' | 'destructive' | 'outline'
      > = {
        ADMIN: 'default',
        MANAGER: 'secondary',
        UNDERWRITER: 'outline',
        SALES: 'outline',
        MEMBER: 'outline'
      };

      return <Badge variant={variants[role]}>{role}</Badge>;
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as UserStatus;
      const colors: Record<UserStatus, string> = {
        ACTIVE: 'bg-green-100 text-green-800 hover:bg-green-200',
        INACTIVE: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        SUSPENDED: 'bg-red-100 text-red-800 hover:bg-red-200',
        INVITED: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      };

      return (
        <Badge variant='outline' className={`border-0 ${colors[status]}`}>
          {status}
        </Badge>
      );
    }
  },
  {
    accessorKey: 'lastOnline',
    header: 'Last Activity',
    cell: ({ row }) => {
      const date = row.getValue('lastOnline') as Date | null;
      if (!date)
        return <span className='text-muted-foreground text-xs'>Never</span>;
      return (
        <span className='text-muted-foreground text-xs'>
          {formatDistanceToNow(new Date(date), { addSuffix: true })}
        </span>
      );
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <span className='sr-only'>Open menu</span>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.email)}
            >
              Copy Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={user.role}
                  onValueChange={(val) =>
                    onUpdateRole(user.id, val as UserRole)
                  }
                >
                  {Object.values(UserRole).map((role) => (
                    <DropdownMenuRadioItem key={role} value={role}>
                      {role}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={user.status}
                  onValueChange={(val) =>
                    onUpdateStatus(user.id, val as UserStatus)
                  }
                >
                  <DropdownMenuRadioItem value='ACTIVE'>
                    Activate
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value='INACTIVE'>
                    Disable
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {user.status === 'INVITED' && (
              <DropdownMenuItem
                onClick={() => {
                  /* Invite logic usually just creates, but here we could re-trigger */
                }}
              >
                Resend Invite
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
  }
];
