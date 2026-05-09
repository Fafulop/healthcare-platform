/**
 * GET /api/pwa-icon?size=512
 *
 * Generates a blue PNG icon with "TuSalud" in Vollkorn serif font.
 * Used by manifest.webmanifest for 192x192 and 512x512 home-screen icons.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createElement } from 'react';

const FONT_URL =
  'https://fonts.gstatic.com/s/vollkorn/v23/0ybgGDoxxrvAnPhYGzMlQLzuMasz6Df2MHGuGQ.woff';

let fontCache: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer | null> {
  if (fontCache) return fontCache;
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    fontCache = await res.arrayBuffer();
    return fontCache;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = Math.min(Math.max(parseInt(searchParams.get('size') || '512'), 16), 1024);
  const fontData = await getFont();

  const fonts = fontData
    ? [{ name: 'Vollkorn', data: fontData, weight: 700 as const, style: 'normal' as const }]
    : undefined;

  return new ImageResponse(
    createElement('div', {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        fontFamily: fontData ? 'Vollkorn' : 'Georgia, serif',
        fontSize: Math.round(size * 0.22),
        color: 'white',
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
    }, 'TuSalud'),
    { width: size, height: size, fonts }
  );
}
