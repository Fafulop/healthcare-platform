// POST /api/revalidate?path=/doctores/[slug] - On-demand revalidation
// Triggers ISR revalidation for a specific path

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Only doctor blog paths are valid revalidation targets
const ALLOWED_PATH_PATTERN = /^\/doctores\/[a-z0-9-]+\/blog(\/[a-z0-9-]+)?$/;

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  // If secret is configured (non-empty), enforce it
  if (!secret) {
    console.warn('[REVALIDATE] REVALIDATE_SECRET is not set — endpoint is unprotected');
  } else if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json(
      { success: false, error: 'path parameter is required' },
      { status: 400 }
    );
  }

  // Only allow revalidating doctor blog paths to prevent cache abuse
  if (!ALLOWED_PATH_PATTERN.test(path)) {
    return NextResponse.json(
      { success: false, error: 'Invalid path' },
      { status: 400 }
    );
  }

  try {
    revalidatePath(path);

    console.log(`✅ Revalidated path: ${path}`);

    return NextResponse.json({
      success: true,
      revalidated: true,
      path,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Revalidation failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revalidate',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
