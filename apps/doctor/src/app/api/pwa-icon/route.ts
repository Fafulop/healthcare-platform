/**
 * GET /api/pwa-icon?size=192
 *
 * Generates a blue PNG icon for the PWA manifest at any requested size.
 * Used by manifest.webmanifest for 192x192 and 512x512 home-screen icons.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = Math.min(Math.max(parseInt(searchParams.get('size') || '192'), 16), 512);

  const pad = Math.round(size * 0.18);
  const crossThick = Math.round(size * 0.14);
  const crossLen = size - pad * 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563eb',
        }}
      >
        {/* Vertical bar of cross */}
        <div
          style={{
            position: 'absolute',
            top: pad,
            left: (size - crossThick) / 2,
            width: crossThick,
            height: crossLen,
            background: 'white',
            borderRadius: crossThick * 0.2,
          }}
        />
        {/* Horizontal bar of cross */}
        <div
          style={{
            position: 'absolute',
            top: (size - crossThick) / 2,
            left: pad,
            width: crossLen,
            height: crossThick,
            background: 'white',
            borderRadius: crossThick * 0.2,
          }}
        />
      </div>
    ),
    { width: size, height: size }
  );
}
