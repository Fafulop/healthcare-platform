/**
 * THE single minter for the short-lived HS256 JWT that apps/api validates
 * (apps/api/src/lib/auth.ts `validateAuthToken`). Used by:
 * - /api/auth/get-token (browser authFetch → apps/api)
 * - the agent route + eval runner, for tools that call apps/api AUTHENTICATED
 *   endpoints (F2a: search_catalogo_sat → /api/facturacion/catalogos)
 *
 * Why minting instead of forwarding (agent case): the agent route is
 * authenticated by the NextAuth SESSION COOKIE (medical-auth `auth()`), so the
 * incoming request has no Bearer token to forward. Same claims, same secret,
 * same trust boundary (the doctor's own session) — just minted server-side.
 *
 * Claims are ONLY what validateAuthToken reads: `email` (identity — role and
 * doctorId are re-fetched from the DB on the API side) and `sessionVersion`
 * (kill-sessions check), plus standard `sub`. Don't add claims here unless
 * apps/api starts reading them.
 */

import jwt from 'jsonwebtoken';

export interface ApiTokenUser {
  email: string;
  userId: string;
  sessionVersion: number;
}

/** Returns null when the signing secret is not configured (callers then
 * report a clear error instead of a mystery 401). */
export function mintApiToken(user: ApiTokenUser): string | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return jwt.sign(
    {
      email: user.email,
      sub: user.userId,
      sessionVersion: user.sessionVersion,
    },
    secret,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}
