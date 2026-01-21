import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({
        authenticated: false,
        session: null,
      });
    }

    // Get user with accounts
    const user = await prisma.user.findUnique({
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
      },
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            accountsCount: user.accounts.length,
            hasAccessToken: !!user.accounts[0]?.access_token,
            hasRefreshToken: !!user.accounts[0]?.refresh_token,
            tokenExpiresAt: user.accounts[0]?.expires_at,
          }
        : null,
    });
  } catch (error: any) {
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
