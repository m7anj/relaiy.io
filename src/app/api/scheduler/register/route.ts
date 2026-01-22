import { getAuthenticatedUser } from "@/lib/auth";
import { registerWorker, unregisterWorker, getScheduledTasks } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";
import { Configuration } from "@/types/configuration";

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get all active workers for this user
    const activeWorkers = await prisma.worker.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        configuration: true,
      },
    });

    let registered = 0;
    let failed = 0;
    const results = [];

    for (const worker of activeWorkers) {
      const config = worker.configuration as unknown as Configuration;

      // Unregister first if already registered
      unregisterWorker(worker.id);

      // Register with scheduler
      const success = registerWorker(worker.id, config.interval);

      if (success) {
        registered++;
        results.push({
          workerId: worker.id,
          name: worker.name,
          interval: config.interval,
          status: 'registered',
        });
      } else {
        failed++;
        results.push({
          workerId: worker.id,
          name: worker.name,
          interval: config.interval,
          status: 'failed',
        });
      }
    }

    const scheduledTasks = getScheduledTasks();

    return Response.json({
      message: `Re-registered ${registered} workers, ${failed} failed`,
      registered,
      failed,
      results,
      scheduledTasks: scheduledTasks.map(t => ({
        workerId: t.workerId,
        cronExpression: t.cronExpression,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
