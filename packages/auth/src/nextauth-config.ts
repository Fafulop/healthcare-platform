import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@healthcare/database";

// Wrap adapter to assign correct role on new user creation.
// Default adapter only sets email, name, image — no knowledge of ADMIN_EMAILS.
const adapter = PrismaAdapter(prisma);
const customAdapter = {
  ...adapter,
  createUser: async (data: any) => {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const role = adminEmails.includes(data.email) ? 'ADMIN' : 'DOCTOR';
    return prisma.user.create({ data: { ...data, role } });
  },
};

export const authConfig: NextAuthConfig = {
  adapter: customAdapter as any,
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // SECURITY: acceptable with Google-only auth (Google guarantees email ownership).
      // MUST be removed if a second OAuth/credentials provider is ever added — it would
      // allow cross-provider account hijacking via matching email.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }: any) {
      if (account?.provider === 'google' && user.email) {
        try {
          // Copy OAuth tokens to User model (Google Calendar integration reads from here)
          await prisma.user.update({
            where: { email: user.email },
            data: {
              googleAccessToken: account.access_token ?? null,
              googleRefreshToken: account.refresh_token ?? null,
              googleTokenExpiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            },
          });

          // Clean up expired sessions for this user on each new login
          await prisma.session.deleteMany({
            where: {
              userId: user.id,
              expires: { lt: new Date() },
            },
          });
        } catch (error) {
          console.error('[SIGN-IN CALLBACK] Error:', error);
          // Do not block login if these operations fail
        }
      }
      return true;
    },

    // session() with database strategy receives:
    //   session — the Session row (session.id is this session's cuid)
    //   user    — the full DB User row loaded by the adapter (all custom fields included)
    // No JWT, no token — everything comes directly from the DB.
    async session({ session, user }: any) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.doctorId = user.doctorId ?? null;
      session.user.sessionVersion = user.sessionVersion ?? 0;
      session.user.privacyConsentAt = user.privacyConsentAt ?? null;
      // Expose session row id so /api/auth/sessions can identify the current session
      session.sessionId = session.id;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  session: {
    strategy: "database" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export the auth function for NextAuth v5
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
