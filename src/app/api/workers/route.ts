import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {

  // 1. checking auth using reusable helper
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. fetch all workers for this user from database
  try {
    const workers = await prisma.worker.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc', // most recent first
      },
    });

    // 3. return workers list
    return Response.json({
      workers,
      count: workers.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
