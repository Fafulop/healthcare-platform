/**
 * Server-side API token for agent tools that call apps/api AUTHENTICATED
 * endpoints (F2a: search_catalogo_sat → /api/facturacion/catalogos).
 *
 * Why minting instead of forwarding: the agent route is authenticated by the
 * NextAuth SESSION COOKIE (medical-auth `auth()`), so the incoming request has
 * no Bearer token to forward. apps/api validates a short-lived HS256 JWT signed
 * with the shared AUTH_SECRET (apps/api/src/lib/auth.ts `validateAuthToken`:
 * verifies signature, reads `email`, and checks `sessionVersion` against the
 * user row). This mints the SAME token the browser gets from
 * /api/auth/get-token — same claims, same secret, same trust boundary (the
 * doctor's own session) — just minted server-side once per turn.
 *
 * If the claims here or in get-token/route.ts change, keep BOTH in sync with
 * what validateAuthToken reads (email + sessionVersion are the load-bearing
 * ones; role/doctorId come from the DB on the API side).
 */

import jwt from 'jsonwebtoken';

export interface ApiTokenUser {
  email: string;
  userId: string;
  role: string;
  doctorId: string;
  sessionVersion: number;
}

/** Returns null when the signing secret is not configured (the tool then
 * reports a clear error instead of a mystery 401). */
export function mintApiToken(user: ApiTokenUser): string | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return jwt.sign(
    {
      email: user.email,
      sub: user.userId,
      userId: user.userId,
      role: user.role,
      doctorId: user.doctorId,
      sessionVersion: user.sessionVersion,
    },
    secret,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}
