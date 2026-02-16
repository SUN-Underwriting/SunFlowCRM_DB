import { NextRequest, NextResponse } from 'next/server';
import { ensureSuperTokensInit } from '@/lib/supertokens/config';
import { getAppDirRequestHandler } from 'supertokens-node/nextjs';

ensureSuperTokensInit();

/**
 * SuperTokens API route handler for /api/auth/*
 * Handles all authentication endpoints (signin, signup, signout, session refresh, etc.)
 *
 * Context7: Based on SuperTokens Next.js App Router documentation
 * - Must return response from getAppDirRequestHandler
 * - GET requests require Cache-Control header to prevent Vercel caching issues
 */
const handleCall = getAppDirRequestHandler();

export async function GET(request: NextRequest) {
  const res = await handleCall(request);
  // Context7: Critical for production - prevent caching of auth endpoints
  if (!res.headers.has('Cache-Control')) {
    res.headers.set(
      'Cache-Control',
      'no-cache, no-store, max-age=0, must-revalidate'
    );
  }
  return res;
}

export async function POST(request: NextRequest) {
  return handleCall(request);
}

export async function DELETE(request: NextRequest) {
  return handleCall(request);
}

export async function PUT(request: NextRequest) {
  return handleCall(request);
}

export async function PATCH(request: NextRequest) {
  return handleCall(request);
}

export async function HEAD(request: NextRequest) {
  return handleCall(request);
}
