/**
 * Apple touch icon — used by iOS Safari for "Add to Home Screen".
 * Must be 180×180 per Apple's guidelines.
 */

import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const pad = Math.round(180 * 0.18);
  const crossThick = Math.round(180 * 0.14);
  const crossLen = 180 - pad * 2;

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
        <div
          style={{
            position: 'absolute',
            top: pad,
            left: (180 - crossThick) / 2,
            width: crossThick,
            height: crossLen,
            background: 'white',
            borderRadius: crossThick * 0.2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: (180 - crossThick) / 2,
            left: pad,
            width: crossLen,
            height: crossThick,
            background: 'white',
            borderRadius: crossThick * 0.2,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
