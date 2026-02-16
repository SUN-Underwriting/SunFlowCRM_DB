'use client';

import {
  useAuthSettings,
  useUpdateAuthSettings
} from '../../hooks/use-settings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';

const authSettingsSchema = z.object({
  emailVerificationRequired: z.boolean(),
  allowSocialLogin: z.boolean(),
  inviteOnly: z.boolean(),
  passwordMinLength: z.number().min(6),
  sessionLifetimeMinutes: z.number().min(15)
});

type AuthSettingsFormValues = z.infer<typeof authSettingsSchema>;

export function AuthSettingsForm() {
  const { data: settings, isLoading } = useAuthSettings();
  const { mutate: updateSettings, isPending } = useUpdateAuthSettings();

  const form = useForm<AuthSettingsFormValues>({
    resolver: zodResolver(authSettingsSchema),
    defaultValues: {
      emailVerificationRequired: false,
      allowSocialLogin: false,
      inviteOnly: false,
      passwordMinLength: 8,
      sessionLifetimeMinutes: 43200 // 30 days
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        emailVerificationRequired: settings.emailVerificationRequired,
        allowSocialLogin: settings.allowSocialLogin,
        inviteOnly: settings.inviteOnly,
        passwordMinLength: settings.passwordMinLength,
        sessionLifetimeMinutes: settings.sessionLifetimeMinutes
      });
    }
  }, [settings, form]);

  function onSubmit(data: AuthSettingsFormValues) {
    updateSettings(data);
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <div className='bg-muted/20 h-64 w-full animate-pulse rounded-md' />
        <div className='bg-muted/20 h-64 w-full animate-pulse rounded-md' />
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className='space-y-6'>
        {/* Authentication Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication Methods</CardTitle>
            <CardDescription>
              Control how users can sign up and log in to your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='inviteOnly'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Invite-only Registration
                    </FormLabel>
                    <FormDescription>
                      If enabled, new users can only join via invitation.
                      Self-signup will be disabled.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        form.handleSubmit(onSubmit)(); // Auto-save on toggle
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='allowSocialLogin'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4 opacity-70'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Social Login (Google, GitHub)
                    </FormLabel>
                    <FormDescription>
                      Enable login via third-party providers. (Coming Soon)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      disabled={true} // Disabled for now as per plan
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Security Policies */}
        <Card>
          <CardHeader>
            <CardTitle>Security Policies</CardTitle>
            <CardDescription>
              Configure password and session security requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='emailVerificationRequired'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Require Email Verification
                    </FormLabel>
                    <FormDescription>
                      Users must verify their email address before accessing the
                      dashboard.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        form.handleSubmit(onSubmit)();
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='grid grid-cols-1 gap-6 pt-2 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='passwordMinLength'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Password Length</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(Number(val));
                        form.handleSubmit(onSubmit)();
                      }}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select length' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='8'>8 characters</SelectItem>
                        <SelectItem value='10'>10 characters</SelectItem>
                        <SelectItem value='12'>
                          12 characters (Recommended)
                        </SelectItem>
                        <SelectItem value='16'>16 characters</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Enforced for new accounts and password resets.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='sessionLifetimeMinutes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Lifetime</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(Number(val));
                        form.handleSubmit(onSubmit)();
                      }}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select duration' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='60'>1 hour</SelectItem>
                        <SelectItem value='1440'>24 hours</SelectItem>
                        <SelectItem value='10080'>7 days</SelectItem>
                        <SelectItem value='43200'>30 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How long a user stays logged in before re-authentication.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* MFA Placeholder */}
        <Card className='bg-muted/50 border-dashed opacity-60'>
          <CardHeader>
            <CardTitle>Multi-Factor Authentication (MFA)</CardTitle>
            <CardDescription>
              Two-factor authentication adds an extra layer of security.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between p-2'>
              <span className='text-sm'>
                MFA enforcement is currently unavailable.
              </span>
              <Button variant='outline' size='sm' disabled>
                Coming in v2.0
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </FormProvider>
  );
}
