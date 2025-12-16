import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
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

    async jwt({ token, user, account, trigger }: any) {
      // On sign in, fetch user info from API
      if (user || trigger === "update") {
        try {
          // Call the API to get/create user and fetch role
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
          }
        } catch (error) {
          console.error("Error fetching user from API:", error);
          // Continue with existing token if API fails
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
      }

      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export the auth function for NextAuth v5
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
