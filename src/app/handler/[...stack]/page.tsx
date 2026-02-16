/**
 * Stack Auth handler page.
 * This route handles all Stack Auth UI flows: sign-in, sign-up, account settings, etc.
 *
 * This page is only active when AUTH_PROVIDER=stack.
 * When using SuperTokens, it renders a "not available" message.
 *
 * Stack Auth docs: https://docs.stack-auth.com/docs/components/stack-handler
 */

export default async function Handler(props: {
  params: Promise<any>;
  searchParams: Promise<any>;
}) {
  const provider = process.env.AUTH_PROVIDER || 'supertokens';

  if (provider !== 'stack') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Not Available</h1>
        <p>
          Stack Auth handler is not active. Current auth provider: {provider}
        </p>
      </div>
    );
  }

  // Dynamic import so Stack Auth is only loaded when needed
  const { StackHandler } = await import('@stackframe/stack');
  const { getStackServerApp } = await import('@/stack/server');

  return (
    <StackHandler
      app={getStackServerApp()}
      routeProps={props}
      fullPage={true}
    />
  );
}
