'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { User, Shield, Users } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible='none' className='bg-background w-64 border-r'>
      <SidebarHeader className='flex h-16 items-start justify-center border-b px-6'>
        <h2 className='text-lg font-semibold tracking-tight'>Settings</h2>
      </SidebarHeader>
      <SidebarContent>
        {/* Personal Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/settings/profile'}
                >
                  <Link href='/settings/profile'>
                    <User />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className='mx-4 w-auto opacity-50' />

        {/* Organization Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === '/settings/organization' ||
                    pathname === '/settings/organization/users'
                  }
                >
                  <Link href='/settings/organization/users'>
                    <Users />
                    <span>Users & Roles</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/settings/organization/auth'}
                >
                  <Link href='/settings/organization/auth'>
                    <Shield />
                    <span>Auth & Security</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
