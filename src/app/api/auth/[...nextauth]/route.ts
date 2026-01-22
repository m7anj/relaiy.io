import NextAuth, { type AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import type { Account, Session } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt" as const, // Use JWT strategy instead of database sessions
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async jwt({ token, account, user }: { token: JWT; account: Account | null; user?: any }) {
      // On initial sign-in, account object contains the tokens
      if (account) {
        console.log('[NextAuth JWT] Initial sign-in, storing tokens');
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        // Store as seconds (Unix timestamp)
        token.accessTokenExpires = account.expires_at;
        token.userId = user?.id;

        // Persist initial tokens to database immediately
        // This ensures DB and JWT are in sync from the start
        if (user?.id) {
          try {
            await prisma.account.updateMany({
              where: {
                userId: user.id,
                provider: 'google',
              },
              data: {
                access_token: account.access_token,
                expires_at: account.expires_at,
                refresh_token: account.refresh_token,
              },
            });
            console.log('[NextAuth JWT] Persisted initial tokens to database');
          } catch (error) {
            console.error('[NextAuth JWT] Failed to persist initial tokens:', error);
          }
        }
      }

      // Check if token is expired
      const now = Date.now();
      // accessTokenExpires is stored in seconds, convert to milliseconds
      const expiresAt = token.accessTokenExpires ? (token.accessTokenExpires as number) * 1000 : 0;
      const isExpired = expiresAt > 0 && now >= expiresAt;

      console.log(`[NextAuth JWT] Token check - Expires: ${expiresAt > 0 ? new Date(expiresAt).toISOString() : 'unknown'}, Expired: ${isExpired}`);

      // If token hasn't expired, return it
      if (token.accessTokenExpires && now < expiresAt) {
        console.log('[NextAuth JWT] Token still valid, returning existing token');
        return token;
      }

      // Token expired, refresh it
      if (token.refreshToken) {
        console.log('[NextAuth JWT] Token expired, refreshing...');
        const refreshedToken = await refreshAccessToken(token);

        // Persist the refreshed token to the database
        if (refreshedToken.accessToken && !refreshedToken.error && token.userId) {
          try {
            await prisma.account.updateMany({
              where: {
                userId: token.userId as string,
                provider: 'google',
              },
              data: {
                access_token: refreshedToken.accessToken as string,
                // accessTokenExpires is already in seconds
                expires_at: refreshedToken.accessTokenExpires as number,
                refresh_token: refreshedToken.refreshToken as string,
              },
            });
            console.log('[NextAuth JWT] Persisted refreshed token to database');
          } catch (error) {
            console.error('[NextAuth JWT] Failed to persist refreshed token:', error);
          }
        }

        return refreshedToken;
      }

      console.log('[NextAuth JWT] No refresh token available');
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // With JWT strategy, token is always available
      if (token) {
        session.accessToken = token.accessToken;
        session.error = token.error;
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

async function refreshAccessToken(token: any) {
  try {
    console.log('[NextAuth] Attempting to refresh access token...');
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error('[NextAuth] Token refresh failed:', refreshedTokens);
      throw refreshedTokens;
    }

    // Store as Unix timestamp in seconds (consistent with initial sign-in)
    const newExpiresAt = Math.floor(Date.now() / 1000) + refreshedTokens.expires_in;
    console.log(`[NextAuth] Token refreshed successfully. New expiry: ${new Date(newExpiresAt * 1000).toISOString()}`);

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: newExpiresAt,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('[NextAuth] Failed to refresh token:', error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}