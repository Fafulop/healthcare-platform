import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma, resolveEffectiveAccess } from "@healthcare/database";

/**
 * 🔴 Una cuenta de Google por usuario (TIERS README, «URGENTE», 2026-09-18).
 *
 * Auth.js (@auth/core 0.41, `handle-login.js`): si alguien entra con una
 * identidad de Google que no está ligada a nadie MIENTRAS ya hay una sesión
 * abierta en ese navegador, NO cambia de usuario — la LIGA al usuario que ya
 * estaba dentro. Desde ese momento ese Google entra como el otro, para
 * siempre. En una computadora compartida del consultorio, un auxiliar que
 * entra con su Google con la sesión del doctor abierta quedaba dentro de la
 * cuenta del doctor. Pasó en prod (lopez.fafutis↔quebradita.a, corregido a
 * mano; y dr-jose tiene 2 identidades).
 *
 * El `signIn` callback no ve la sesión abierta, así que la regla va aquí, en el
 * único punto por el que pasa todo vínculo: si el usuario YA tiene una
 * identidad de ese proveedor, se rechaza la segunda. El alta normal (usuario
 * sin identidad todavía, p.ej. creado por el admin) sigue igual. Falla hacia
 * «no entra», nunca hacia «entra como otro».
 *
 * ⚠️ Auth.js envuelve TODO error lanzado desde el adapter en un `AdapterError`
 * (`@auth/core/lib/init.js`, `adapterErrorHandler`), así que esto llega a la
 * pantalla de login como `?error=Configuration`, no con un código propio. Por
 * eso el mensaje de `Configuration` en el login menciona la sesión abierta.
 */

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
  linkAccount: async (data: any) => {
    const yaTiene = await prisma.account.count({
      where: { userId: data.userId, provider: data.provider },
    });
    if (yaTiene > 0) {
      console.error('[AUTH] se rechazó ligar una SEGUNDA identidad al mismo usuario', {
        userId: data.userId,
        provider: data.provider,
      });
      throw new Error('El usuario ya tiene una cuenta de este proveedor (una cuenta de Google por usuario)');
    }
    return adapter.linkAccount!(data);
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
      session.user.sessionVersion = user.sessionVersion ?? 0;
      session.user.privacyConsentAt = user.privacyConsentAt ?? null;

      // EFFECTIVE doctor resolution (secondary users): ACTIVE membership in
      // doctor_members wins, legacy user.doctorId is the owner fallback.
      // Runs on every request (database sessions) — permission toggles and
      // revocations apply on the member's next request without re-login.
      const access = await resolveEffectiveAccess(prisma, user.id, user.doctorId ?? null);
      session.user.doctorId = access.doctorId;
      session.user.isOwner = access.isOwner;
      session.user.permissions = access.permissions;
      session.user.membershipRevoked = access.membershipRevoked;
      // Account tier (fresh via database sessions). Threaded for TIERS T2 —
      // client courtesy only; no consumer enforces it yet.
      session.user.tier = access.tier;

      // Expose session row id so /api/auth/sessions can identify the current session
      session.sessionId = session.id;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: "database" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export the auth function for NextAuth v5
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
