/**
 * GET /api/pwa-icon?size=512
 *
 * Generates a crisp PNG icon for the PWA manifest at any requested size.
 * Renders a white laurel wreath on the theme blue (#2563eb) using CSS shapes.
 * Used by manifest.webmanifest for 192x192 and 512x512 home-screen icons.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

/** Each leaf: [centerX%, centerY%, rotation in degrees, scaleX, scaleY] */
const LEFT_LEAVES: [number, number, number, number, number][] = [
  [30, 78, 30, 0.8, 1],
  [24, 68, 20, 0.7, 1],
  [20, 57, 10, 0.7, 1],
  [19, 46, -2, 0.7, 1],
  [21, 35, -15, 0.7, 0.95],
  [26, 26, -28, 0.6, 0.9],
  [33, 19, -42, 0.6, 0.85],
  [41, 14, -55, 0.5, 0.75],
];

const RIGHT_LEAVES: [number, number, number, number, number][] = LEFT_LEAVES.map(
  ([x, y, rot, sx, sy]) => [100 - x, y, -rot, sx, sy]
);

function Leaf({
  x, y, rot, sx, sy, base,
}: {
  x: number; y: number; rot: number; sx: number; sy: number; base: number;
}) {
  const w = base * sx;
  const h = base * sy;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: w,
        height: h,
        borderRadius: '50%',
        backgroundColor: 'white',
        transform: `translate(-50%, -50%) rotate(${rot}deg)`,
      }}
    />
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = Math.min(
    Math.max(parseInt(searchParams.get('size') || '512'), 16),
    1024
  );

  const leafBase = size * 0.14;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#2563eb',
          position: 'relative',
        }}
      >
        {LEFT_LEAVES.map(([x, y, rot, sx, sy], i) => (
          <Leaf key={i} x={x} y={y} rot={rot} sx={sx} sy={sy} base={leafBase} />
        ))}
        {RIGHT_LEAVES.map(([x, y, rot, sx, sy], i) => (
          <Leaf key={i + 8} x={x} y={y} rot={rot} sx={sx} sy={sy} base={leafBase} />
        ))}
      </div>
    ),
    { width: size, height: size }
  );
}
