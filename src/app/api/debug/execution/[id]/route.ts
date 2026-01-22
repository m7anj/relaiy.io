import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }
  
  try {
    // Verify worker belongs to user
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { userId: true, name: true },
    });

    if (!worker || worker.userId !== user.id) {
      return Response.json({ message: "Not found" }, { status: 404 });
    }

    // Get all executions for this worker
    const executions = await prisma.workerExecution.findMany({
      where: { workerId },
      orderBy: { executedAt: 'desc' },
      take: 10,
    });

    return Response.json({
      workerName: worker.name,
      executionCount: executions.length,
      executions: executions.map(e => ({
        id: e.id,
        status: e.status,
        executedAt: e.executedAt.toISOString(),
        duration: e.duration,
        emailCount: e.emailCount,
        isDryRun: e.isDryRun,
        error: e.error,
        actionsPerformed: e.actionsPerformed,
        affectedEmails: e.affectedEmails,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
