import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // Redirect www to non-www (permanent 301 for SEO)
  if (host.startsWith('www.')) {
    const nonWwwHost = host.slice(4) // strip "www."
    const url = request.nextUrl.clone()
    url.host = nonWwwHost
    // Preserve protocol: if request came in as HTTP, upgrade to HTTPS
    url.protocol = 'https:'
    return NextResponse.redirect(url, { status: 301 })
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
