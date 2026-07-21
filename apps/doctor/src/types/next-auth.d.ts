import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    sessionId?: string; // current session's DB id — used by /api/auth/sessions to mark current
    user: {
      id: string;
      role: string;
      /** EFFECTIVE doctor (ACTIVE doctor_members membership first, legacy User.doctorId fallback). */
      doctorId: string | null;
      /** true for portal owners (membership OWNER or legacy fallback). */
      isOwner: boolean;
      /** null for owners (= everything). Members: toggle set — read via hasPermission() (fail-closed). */
      permissions: Partial<Record<string, boolean>> | null;
      /** No ACTIVE membership but a REVOKED one exists → show "acceso revocado", never onboarding. */
      membershipRevoked: boolean;
      privacyConsentAt: Date | string | null; // Date from DB, string when serialized to client
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    doctorId?: string | null;
  }
}

// Required so the session() callback can access custom fields on the `user` parameter.
declare module "next-auth/adapters" {
  interface AdapterUser {
    role: string;
    doctorId: string | null;
    sessionVersion: number;
    privacyConsentAt: Date | null;
  }
}

// JWT interface extensions are dead code after database strategy migration
// (jwt() callback is removed). Kept to avoid breaking any imports.
declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    doctorId?: string | null;
    privacyConsentAt?: string | null;
    sessionVersion?: number;
  }
}
