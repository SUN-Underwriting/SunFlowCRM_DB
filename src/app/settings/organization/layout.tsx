'use client';

export default function OrganizationSettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Keep layout unguarded on client; API routes enforce ADMIN authorization.
  return <>{children}</>;
}
