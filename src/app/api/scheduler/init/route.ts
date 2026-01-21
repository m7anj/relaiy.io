import { initializeScheduler, getScheduledTasks } from '@/lib/scheduler';

/**
 * POST /api/scheduler/init
 * Initialize the cron scheduler by loading all ACTIVE workers
 * This should be called once when the application starts
 */
export async function POST() {
  try {
    const result = await initializeScheduler();

    return Response.json({
      message: 'Scheduler initialized successfully',
      registered: result.registered,
      failed: result.failed,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json(
      { message: 'Failed to initialize scheduler', error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduler/init
 * Get information about currently scheduled tasks
 * Useful for debugging and monitoring
 */
export async function GET() {
  try {
    const tasks = getScheduledTasks();

    return Response.json({
      message: 'Scheduled tasks retrieved successfully',
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json(
      { message: 'Failed to get scheduled tasks', error: errorMessage },
      { status: 500 }
    );
  }
}
