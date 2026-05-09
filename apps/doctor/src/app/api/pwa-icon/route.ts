/**
 * GET /api/pwa-icon?size=192
 *
 * Generates a blue PNG icon for the PWA manifest at any requested size.
 * Used by manifest.webmanifest for 192x192 and 512x512 home-screen icons.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createElement } from 'react';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = Math.min(Math.max(parseInt(searchParams.get('size') || '192'), 16), 512);

  return new ImageResponse(
    createElement('div', {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        fontSize: Math.round(size * 0.55),
        color: 'white',
        fontWeight: '900',
      },
    }, '+'),
    { width: size, height: size }
  );
}
