'use client';

import { OAuthButtonGroup } from '@stackframe/stack';

/**
 * Stack Auth OAuth buttons.
 * Renders all OAuth providers enabled in the Stack Auth Dashboard (Google, GitHub, etc.).
 * This component is loaded via next/dynamic only when AUTH_PROVIDER=stack.
 */
export default function StackOAuthButtons() {
  return (
    <>
      <OAuthButtonGroup type='sign-in' />
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background text-muted-foreground px-2'>
            Or continue with email
          </span>
        </div>
      </div>
    </>
  );
}
