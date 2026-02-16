import { NextRequest, NextResponse } from 'next/server';
import { getAuthAdapter } from '@/lib/auth/providers/factory';

/**
 * Auth API route handler for /api/auth/*
 * Handles all authentication endpoints via the configured auth provider.
 * Supports both SuperTokens and Stack Auth depending on AUTH_PROVIDER env variable.
 *
 * Uses lazy initialization to avoid loading Stack Auth when SuperTokens is active.
 */
let handleCall: ((request: NextRequest) => Promise<NextResponse>) | null = null;

async function getHandler() {
  if (!handleCall) {
    const authAdapter = await getAuthAdapter();
    handleCall = authAdapter.getApiHandler();
  }
  return handleCall;
}

export async function GET(request: NextRequest) {
  const handler = await getHandler();
  const res = await handler(request);
  // Critical for production - prevent caching of auth endpoints
  if (!res.headers.has('Cache-Control')) {
    res.headers.set(
      'Cache-Control',
      'no-cache, no-store, max-age=0, must-revalidate'
    );
  }
  return res;
}

export async function POST(request: NextRequest) {
  const handler = await getHandler();
  return handler(request);
}

export async function DELETE(request: NextRequest) {
  const handler = await getHandler();
  return handler(request);
}

export async function PUT(request: NextRequest) {
  const handler = await getHandler();
  return handler(request);
}

export async function PATCH(request: NextRequest) {
  const handler = await getHandler();
  return handler(request);
}

export async function HEAD(request: NextRequest) {
  const handler = await getHandler();
  return handler(request);
}
