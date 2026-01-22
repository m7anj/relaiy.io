import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = await getAuthenticatedUser();

    if (!session?.user?.email) {
      return Response.json({
        authenticated: false,
        session: null,
        user: null,
      });
    }

    // Get full user details with accounts
    const fullUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: {
          select: {
            provider: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
          },
        },
      },
    });

    return Response.json({
      authenticated: true,
      session: {
        user: session.user,
        expires: session.expires,
        hasAccessToken: !!session.accessToken,
        error: session.error,
      },
      user: fullUser
        ? {
            id: fullUser.id,
            email: fullUser.email,
            name: fullUser.name,
            accountsCount: fullUser.accounts.length,
            hasAccessToken: !!fullUser.accounts[0]?.access_token,
            hasRefreshToken: !!fullUser.accounts[0]?.refresh_token,
            tokenExpiresAt: fullUser.accounts[0]?.expires_at
              ? new Date(fullUser.accounts[0].expires_at * 1000).toISOString()
              : null,
            tokenExpired: fullUser.accounts[0]?.expires_at
              ? Date.now() >= (fullUser.accounts[0].expires_at * 1000)
              : null,
          }
        : null,
      authHelper: {
        exists: !!user,
        id: user?.id,
        email: user?.email,
        hasAccount: user?.accounts && user.accounts.length > 0,
        hasAccessToken: user?.accounts?.[0]?.access_token ? true : false,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return Response.json(
      {
        error: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    );
  }
}
