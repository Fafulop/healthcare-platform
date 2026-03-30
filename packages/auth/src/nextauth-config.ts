import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
    async signIn({ user, account, profile }: any) {
      // Allow all Google authentications
      // Role verification happens via API calls after login
      return true;
    },

    async jwt({ token, user, account, trigger, session }: any) {
      // If the client passed a privacyConsentAt directly via update(), apply it immediately
      // without re-fetching from the DB (avoids race condition on consent save).
      if (trigger === "update" && session?.privacyConsentAt !== undefined) {
        token.privacyConsentAt = session.privacyConsentAt;
        return token;
      }

      // On sign in, on explicit update, or when doctorId is missing (user may
      // have been linked to a doctor profile after their initial login)
      if (user || trigger === "update" || !token.doctorId) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

          const response = await fetch(`${apiUrl}/api/auth/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user?.email || token.email,
              name: user?.name || token.name,
              image: user?.image || token.picture,
            }),
          });

          if (response.ok) {
            const dbUser = await response.json();
            token.userId = dbUser.id;
            token.role = dbUser.role;
            token.doctorId = dbUser.doctorId;
            token.name = dbUser.name;
            token.picture = dbUser.image;
            token.privacyConsentAt = dbUser.privacyConsentAt ?? null;
          } else {
            console.error('[JWT CALLBACK] API response not OK:', response.status);
          }
        } catch (error) {
          console.error("[JWT CALLBACK] Error fetching user from API:", error);
          // Continue with existing token if API fails
        }
      }

      // On fresh sign-in, account contains Google OAuth tokens — save them to DB.
      // account is only present on the first jwt() call after OAuth login.
      if (account?.provider === "google" && account.access_token) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
          await fetch(`${apiUrl}/api/auth/google-calendar/tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user?.email || token.email,
              accessToken: account.access_token,
              refreshToken: account.refresh_token ?? null,
              expiresAt: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : null,
            }),
          });
        } catch (error) {
          console.error("[JWT CALLBACK] Error saving Google Calendar tokens:", error);
        }
      }

      return token;
    },

    async session({ session, token }: any) {
      // Attach user info to session
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.doctorId = token.doctorId as string | null;
        session.user.privacyConsentAt = token.privacyConsentAt as string | null;
      }

      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export the auth function for NextAuth v5
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
