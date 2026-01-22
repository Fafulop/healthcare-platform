// CORS Middleware
// Allows cross-origin requests from our frontend apps

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// All allowed headers for CORS
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'authorization',
  // UploadThing headers
  'x-uploadthing-package',
  'x-uploadthing-version',
  'x-uploadthing-api-key',
  'x-uploadthing-fe-package',
  'x-uploadthing-be-adapter',
  // Tracing headers (OpenTelemetry, Zipkin B3, Sentry, etc.)
  'traceparent',
  'tracestate',
  'baggage',
  'sentry-trace',
  'b3',
  'x-b3-traceid',
  'x-b3-spanid',
  'x-b3-parentspanid',
  'x-b3-sampled',
  'x-b3-flags',
  'x-request-id',
  'x-correlation-id',
].join(', ');

export function middleware(request: NextRequest) {
  // Get allowed origins from environment variable
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000', // public
    'http://localhost:3001', // doctor
    'http://localhost:3002', // admin
  ];

  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = allowedOrigins.includes(origin);

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Handle actual requests
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

// Apply middleware to API routes only
export const config = {
  matcher: '/api/:path*',
};
