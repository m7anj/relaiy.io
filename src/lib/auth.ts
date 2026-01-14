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

  return user;
}
