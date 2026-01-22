import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

/**
 * Reusable auth helper - call this at the start of any API route
 * Returns authenticated user with Google account info, or null if not authenticated
 */
export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    console.log('[Auth] No session or user email');
    return null;
  }

  // If token refresh failed, force re-authentication
  if (session.error === "RefreshAccessTokenError") {
    console.error('[Auth] Token refresh failed, forcing re-authentication');
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      accounts: {
        where: { provider: 'google' },
        select: {
          access_token: true,
          refresh_token: true,
          expires_at: true,
        }
      }
    },
  });

  if (!user) {
    console.error('[Auth] User not found in database');
    return null;
  }

  if (!user.accounts || user.accounts.length === 0) {
    console.error('[Auth] No Google account linked');
    return null;
  }

  // Check if DB token is expired
  let dbTokenExpired = false;
  let tokenExpiresAt: Date | null = null;
  if (user.accounts[0].expires_at) {
    const expiresAt = user.accounts[0].expires_at * 1000;
    const now = Date.now();
    dbTokenExpired = now >= expiresAt;
    tokenExpiresAt = new Date(expiresAt);
    console.log(`[Auth] DB token expires at: ${tokenExpiresAt.toISOString()}, Is expired: ${dbTokenExpired}`);
  }

  // If session has a refreshed access token (from JWT), use it instead of DB token
  // This handles cases where the token was refreshed after server restart
  if (session.accessToken) {
    console.log('[Auth] Using refreshed token from JWT session');
    if (user.accounts[0]) {
      user.accounts[0].access_token = session.accessToken as string;
    }
  } else if (dbTokenExpired) {
    // DB token is expired and no refreshed token in session
    // This means the JWT refresh hasn't run yet or failed
    console.error(`[Auth] Token expired at ${tokenExpiresAt?.toISOString()}. User needs to sign out and sign back in.`);
    // Return null to force re-authentication
    return null;
  } else {
    console.log('[Auth] Using token from database');
  }

  return user;
}
