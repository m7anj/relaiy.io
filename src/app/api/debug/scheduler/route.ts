import { getScheduledTasks } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get all scheduled tasks
    const scheduledTasks = getScheduledTasks();

    // Get active workers from database
    const activeWorkers = await prisma.worker.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        status: true,
        configuration: true,
        executionCount: true,
        lastExecutedAt: true,
      },
    });

    return Response.json({
      scheduledTasksCount: scheduledTasks.length,
      scheduledTasks: scheduledTasks.map(t => ({
        workerId: t.workerId,
        cronExpression: t.cronExpression,
      })),
      activeWorkersCount: activeWorkers.length,
      activeWorkers: activeWorkers.map(w => ({
        id: w.id,
        name: w.name,
        status: w.status,
        interval: (w.configuration as any)?.interval,
        executionCount: w.executionCount,
        lastExecutedAt: w.lastExecutedAt?.toISOString(),
        isScheduled: scheduledTasks.some(t => t.workerId === w.id),
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
