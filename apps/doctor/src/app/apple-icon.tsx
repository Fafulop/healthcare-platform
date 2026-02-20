/**
 * Apple touch icon — used by iOS Safari for "Add to Home Screen".
 * Must be 180×180 per Apple's guidelines.
 */

import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 99,
          color: 'white',
          fontWeight: '900',
        }}
      >
        +
      </div>
    ),
    { ...size }
  );
}
