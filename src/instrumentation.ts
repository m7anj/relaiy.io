/**
 * Next.js Instrumentation Hook
 * This file runs once when the Next.js server starts
 * Perfect for initializing the scheduler with all ACTIVE workers
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeScheduler } = await import('./lib/scheduler');

    console.log('Server starting - initializing scheduler...');

    try {
      const result = await initializeScheduler();
      console.log(`Scheduler initialized: ${result.registered} workers registered, ${result.failed} failed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize scheduler on startup:', errorMessage);
    }
  }
}
