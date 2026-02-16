/**
 * Global loading boundary (Suspense fallback).
 * Required by Stack Auth for async hooks to work correctly.
 * Docs: https://docs.stack-auth.com/docs/getting-started/setup
 */
export default function Loading() {
  return (
    <div className='flex h-screen w-full items-center justify-center'>
      <div className='border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent' />
    </div>
  );
}
