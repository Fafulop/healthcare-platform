// POST /api/revalidate?path=/doctores/[slug] - On-demand revalidation
// Triggers ISR revalidation for a specific path

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json(
      { success: false, error: 'path parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Revalidate the specified path
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
