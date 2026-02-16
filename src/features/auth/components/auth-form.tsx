'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { useRouter } from 'next/navigation';
import {
  getAuthClientAdapter,
  getAuthProviderType
} from '@/lib/auth/providers/client-factory';
import { Icons } from '@/components/icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';

// Get the configured auth adapter
const authAdapter = getAuthClientAdapter();
const authProvider = getAuthProviderType();

interface AuthFormProps {
  mode: 'signin' | 'signup';
}

// Zod validation schema
const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

type SignInFormData = z.infer<typeof signInSchema>;

/**
 * OAuth buttons for Stack Auth — loaded via next/dynamic to avoid
 * blocking Turbopack compilation when Stack Auth is not the active provider.
 */
const StackOAuthButtons =
  authProvider === 'stack'
    ? dynamic(() => import('./stack-oauth-buttons'), { ssr: false })
    : () => null;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: SignInFormData) => {
    try {
      if (mode === 'signup') {
        setError('root', {
          message:
            'Sign up is disabled. Please contact your administrator for an invite.'
        });
        return;
      }

      const response = await authAdapter.signIn(data.email, data.password);

      if (response.status === 'FIELD_ERROR') {
        setError('root', {
          message: response.message
        });
      } else if (response.status === 'WRONG_CREDENTIALS') {
        setError('root', {
          message: 'Invalid email or password'
        });
      } else if (response.status === 'SIGN_IN_NOT_ALLOWED') {
        setError('root', {
          message:
            response.message ||
            'Sign in is not allowed. Please contact support.'
        });
      } else {
        // Success - redirect to dashboard
        router.push('/dashboard/overview');
      }
    } catch (err) {
      setError('root', {
        message: 'An unexpected error occurred. Please try again.'
      });
      console.error('Auth error:', err);
    }
  };

  return (
    <div className='w-full space-y-4'>
      {/* OAuth buttons (Google, GitHub, etc.) — only for Stack Auth */}
      <StackOAuthButtons />

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            type='email'
            placeholder='name@example.com'
            disabled={isSubmitting}
            aria-label='Email address'
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p
              id='email-error'
              role='alert'
              className='text-destructive text-sm'
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='password'>Password</Label>
          <PasswordInput
            id='password'
            placeholder='Enter your password'
            disabled={isSubmitting}
            aria-label='Password'
            aria-describedby={errors.password ? 'password-error' : undefined}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p
              id='password-error'
              role='alert'
              className='text-destructive text-sm'
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {errors.root && (
          <div
            role='alert'
            className='bg-destructive/10 text-destructive rounded-md p-3 text-sm'
          >
            {errors.root.message}
          </div>
        )}

        <Button
          type='submit'
          className='w-full'
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          aria-live='polite'
        >
          {isSubmitting && (
            <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          )}
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
