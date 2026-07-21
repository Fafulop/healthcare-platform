import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Extends the built-in session type to include custom fields
   */
  interface Session {
    user: {
      id: string;
      role: string;
      /** EFFECTIVE doctor (ACTIVE doctor_members membership first, legacy User.doctorId fallback). */
      doctorId: string | null;
      isOwner: boolean;
      permissions: Partial<Record<string, boolean>> | null;
      membershipRevoked: boolean;
    } & DefaultSession["user"];
  }

  /**
   * Extends the built-in user type
   */
  interface User {
    role?: string;
    doctorId?: string | null;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the JWT token to include custom fields
   */
  interface JWT {
    userId?: string;
    role?: string;
    doctorId?: string | null;
    sessionVersion?: number;
  }
}
