import * as cron from 'node-cron';
import { prisma } from './prisma';
import { fetchEmailsFromRecipients, sendEmail, getGmailClient } from './gmail';
import { generateEmailPreviews } from './preview';
import { fetchConversationWithRecipients } from './conversationHistory';
import { Configuration } from '@/types/configuration';
import { WorkerType } from '@/types/worker';
import { ExecutionStatus } from '@/generated/prisma';
import type { Prisma } from '@/generated/prisma';

interface ScheduledTask {
  workerId: string;
  cronExpression: string;
  task: cron.ScheduledTask;
}

interface ExecutionAction {
  action: "email_sent" | "email_simulated";
  recipient: string;
  subject: string;
  body: string;
  timestamp: string;
  result: "sent" | "dry_run";
}

// Store for all scheduled tasks
const scheduledTasks = new Map<string, ScheduledTask>();

/**
 * Parse natural language interval into cron expression
 * Examples:
 * - "daily at 9am" -> "0 9 * * *"
 * - "every Monday at 10am" -> "0 10 * * 1"
 * - "every 3 days" -> Special handling (not standard cron)
 */
export function parseIntervalToCron(interval: string): string {
  const normalized = interval.toLowerCase().trim();

  // Daily patterns
  if (normalized.match(/^daily at (\d{1,2})(am|pm)$/)) {
    const match = normalized.match(/^daily at (\d{1,2})(am|pm)$/);
    if (match) {
      let hour = parseInt(match[1]);
      const period = match[2];

      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;

      return `0 ${hour} * * *`;
    }
  }

  // Weekly patterns (every Monday, every Tuesday, etc.)
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [day, num] of Object.entries(dayMap)) {
    if (normalized.match(new RegExp(`^every ${day}( at (\\d{1,2})(am|pm))?$`))) {
      const match = normalized.match(new RegExp(`^every ${day}( at (\\d{1,2})(am|pm))?$`));
      if (match) {
        if (match[2]) {
          let hour = parseInt(match[2]);
          const period = match[3];

          if (period === 'pm' && hour !== 12) hour += 12;
          if (period === 'am' && hour === 12) hour = 0;

          return `0 ${hour} * * ${num}`;
        }
        // Default to 9am if no time specified
        return `0 9 * * ${num}`;
      }
    }
  }

  // Minute patterns (every N minutes)
  if (normalized.match(/^every (\d+) minute(s)?$/)) {
    const match = normalized.match(/^every (\d+) minute(s)?$/);
    if (match) {
      const minutes = parseInt(match[1]);
      if (minutes >= 1 && minutes <= 59) {
        return `*/${minutes} * * * *`;
      }
    }
  }

  // Second patterns (convert to minutes - cron doesn't support seconds)
  // For testing: "every 10 seconds" -> run every minute
  if (normalized.match(/^every (\d+) second(s)?$/)) {
    console.warn(`Seconds not supported in cron. Converting "${interval}" to every minute.`);
    return `* * * * *`; // Every minute
  }

  // Hourly patterns
  if (normalized.match(/^every (\d+) hour(s)?$/)) {
    const match = normalized.match(/^every (\d+) hour(s)?$/);
    if (match) {
      const hours = parseInt(match[1]);
      return `0 */${hours} * * *`;
    }
  }

  // Every N days (run daily at 9am, but check lifespan tracking for actual frequency)
  if (normalized.match(/^every (\d+) day(s)?$/)) {
    // We'll run daily but the execution logic can check lastExecutedAt
    return `0 9 * * *`;
  }

  // Default fallback: daily at 9am
  console.warn(`Could not parse interval "${interval}", defaulting to daily at 9am`);
  return '0 9 * * *';
}

/**
 * Execute a worker's automation logic
 * This is the core execution function called by both manual triggers and cron
 */
export async function executeWorker(
  workerId: string,
  isDryRun: boolean = false
): Promise<{ success: boolean; executionId: string; error?: string }> {
  const startTime = Date.now();

  try {
    // 1. Fetch worker with all necessary data
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        user: {
          include: {
            accounts: {
              where: { provider: 'google' },
              take: 1,
            },
          },
        },
      },
    });

    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    // 2. Check if worker should execute
    if (worker.status !== 'ACTIVE') {
      throw new Error(`Worker is not active (status: ${worker.status})`);
    }

    // 3. Get access token
    const accessToken = worker.user.accounts[0]?.access_token;
    if (!accessToken) {
      throw new Error('No Google access token available');
    }

    const config = worker.configuration as unknown as Configuration;

    // 4. Check lifespan - stop if reached
    if (config.lifespan && worker.executionCount >= config.lifespan) {
      await prisma.worker.update({
        where: { id: workerId },
        data: { status: 'STOPPED' },
      });

      // Unregister from scheduler
      unregisterWorker(workerId);

      throw new Error(`Worker has reached its lifespan limit (${config.lifespan} executions)`);
    }

    // 5. Create execution log with RUNNING status
    const execution = await prisma.workerExecution.create({
      data: {
        workerId,
        status: ExecutionStatus.RUNNING,
        affectedEmails: [],
        emailCount: 0,
        actionsPerformed: [],
        isDryRun,
      },
    });

    // 6. Execute worker logic
    const affectedEmails: string[] = [];
    const actionsPerformed: ExecutionAction[] = [];

    try {
      // Fetch context emails if configured
      const contextEmails: Array<{ snippet?: string; subject?: string }> = [];
      if (config.contextEmails?.from && config.contextEmails.from.length > 0) {
        const gmail = getGmailClient(accessToken);
        const messages = await fetchEmailsFromRecipients(
          accessToken,
          config.contextEmails.from
        );

        // Fetch full email details for context
        for (const message of messages.slice(0, 3)) {
          if (message.id) {
            affectedEmails.push(message.id);

            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'full',
            });

            contextEmails.push({
              subject: fullMessage.data.payload?.headers?.find(h => h.name === 'Subject')?.value || '',
              snippet: fullMessage.data.snippet || '',
            });
          }
        }
      }

      // Fetch FULL conversation history with recipients (both sent and received emails)
      const fullConversationHistory = await fetchConversationWithRecipients(
        accessToken,
        config.recipients,
        20 // Get up to 20 most recent emails per recipient
      );

      // Also fetch previous worker execution emails for context
      const previousExecutions = await prisma.workerExecution.findMany({
        where: {
          workerId,
          status: 'SUCCESS',
        },
        orderBy: {
          executedAt: 'desc',
        },
        take: 5, // Last 5 successful executions
        select: {
          actionsPerformed: true,
          executedAt: true,
        },
      });

      // Extract previous emails from execution history
      const conversationHistory: Array<{ recipient: string; subject: string; body: string; sentAt: string }> = [];

      // Add execution history
      for (const execution of previousExecutions) {
        const actions = execution.actionsPerformed as any[];
        if (Array.isArray(actions)) {
          for (const action of actions) {
            if (action.action === 'email_sent' && action.recipient && action.subject && action.body) {
              conversationHistory.push({
                recipient: action.recipient,
                subject: action.subject,
                body: action.body,
                sentAt: action.timestamp || execution.executedAt.toISOString(),
              });
            }
          }
        }
      }

      // Add full Gmail conversation history (includes recipient responses!)
      for (const email of fullConversationHistory) {
        conversationHistory.push({
          recipient: email.direction === 'sent' ? email.to : email.from,
          subject: email.subject,
          body: email.body,
          sentAt: email.timestamp,
        });
      }

      // Generate actual email content using LLM
      const emailPreviews = await generateEmailPreviews(
        config,
        worker.type as WorkerType,
        worker.name,
        contextEmails,
        conversationHistory
      );

      // Send emails to recipients
      for (const emailPreview of emailPreviews) {
        await sendEmail(
          accessToken,
          [emailPreview.recipient],
          emailPreview.subject,
          emailPreview.body,
          isDryRun
        );

        actionsPerformed.push({
          action: isDryRun ? 'email_simulated' : 'email_sent',
          recipient: emailPreview.recipient,
          subject: emailPreview.subject,
          body: emailPreview.body,
          timestamp: new Date().toISOString(),
          result: isDryRun ? 'dry_run' : 'sent',
        });
      }

      // 7. Update execution to SUCCESS and increment worker count
      const duration = Date.now() - startTime;
      await prisma.$transaction([
        prisma.workerExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.SUCCESS,
            affectedEmails,
            emailCount: affectedEmails.length,
            actionsPerformed: actionsPerformed as unknown as Prisma.InputJsonValue,
            duration,
          },
        }),
        prisma.worker.update({
          where: { id: workerId },
          data: {
            executionCount: { increment: 1 },
            lastExecutedAt: new Date(),
            lastExecutionStatus: ExecutionStatus.SUCCESS,
          },
        }),
      ]);

      return { success: true, executionId: execution.id };
    } catch (executionError) {
      // Handle execution failure
      const duration = Date.now() - startTime;
      const errorMessage = executionError instanceof Error ? executionError.message : String(executionError);
      const errorStack = executionError instanceof Error ? executionError.stack : undefined;

      await prisma.$transaction([
        prisma.workerExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.ERROR,
            affectedEmails,
            emailCount: affectedEmails.length,
            actionsPerformed: actionsPerformed as unknown as Prisma.InputJsonValue,
            duration,
            error: errorMessage,
            errorStack,
          },
        }),
        prisma.worker.update({
          where: { id: workerId },
          data: {
            executionCount: { increment: 1 },
            lastExecutedAt: new Date(),
            lastExecutionStatus: ExecutionStatus.ERROR,
          },
        }),
      ]);

      return { success: false, executionId: execution.id, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to execute worker ${workerId}:`, errorMessage);

    // Create a failed execution record
    const execution = await prisma.workerExecution.create({
      data: {
        workerId,
        status: ExecutionStatus.ERROR,
        affectedEmails: [],
        emailCount: 0,
        actionsPerformed: [],
        isDryRun,
        error: errorMessage,
        duration: Date.now() - startTime,
      },
    });

    return { success: false, executionId: execution.id, error: errorMessage };
  }
}

/**
 * Register a worker with the cron scheduler
 * This schedules automatic execution based on the worker's interval
 */
export function registerWorker(workerId: string, interval: string): boolean {
  try {
    // If already registered, unregister first
    if (scheduledTasks.has(workerId)) {
      unregisterWorker(workerId);
    }

    // Parse interval to cron expression
    const cronExpression = parseIntervalToCron(interval);

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      console.error(`Invalid cron expression for worker ${workerId}: ${cronExpression}`);
      return false;
    }

    // Schedule the task
    const task = cron.schedule(
      cronExpression,
      async () => {
        const now = new Date().toISOString();
        console.log(`[${now}] Cron triggered for worker: ${workerId}`);
        const result = await executeWorker(workerId, false);

        if (result.success) {
          console.log(`[${now}] Worker ${workerId} executed successfully. Execution ID: ${result.executionId}`);
        } else {
          console.error(`[${now}] Worker ${workerId} execution failed: ${result.error}`);
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    // Store the scheduled task
    scheduledTasks.set(workerId, {
      workerId,
      cronExpression,
      task,
    });

    console.log(`Registered worker ${workerId} with cron: ${cronExpression}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to register worker ${workerId}:`, errorMessage);
    return false;
  }
}

/**
 * Unregister a worker from the cron scheduler
 * Call this when a worker is paused, stopped, or deleted
 */
export function unregisterWorker(workerId: string): boolean {
  const scheduled = scheduledTasks.get(workerId);

  if (!scheduled) {
    return false;
  }

  // Stop the cron task
  scheduled.task.stop();

  // Remove from map
  scheduledTasks.delete(workerId);

  console.log(`Unregistered worker ${workerId}`);
  return true;
}

/**
 * Initialize the scheduler by loading all ACTIVE workers from the database
 * Call this once when the application starts
 */
export async function initializeScheduler(): Promise<{ registered: number; failed: number }> {
  console.log('Initializing worker scheduler...');

  try {
    // Fetch all ACTIVE workers
    const activeWorkers = await prisma.worker.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        configuration: true,
      },
    });

    let registered = 0;
    let failed = 0;

    // Register each active worker
    for (const worker of activeWorkers) {
      const config = worker.configuration as unknown as Configuration;

      if (registerWorker(worker.id, config.interval)) {
        registered++;
      } else {
        failed++;
      }
    }

    console.log(`Scheduler initialized: ${registered} workers registered, ${failed} failed`);
    return { registered, failed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize scheduler:', errorMessage);
    return { registered: 0, failed: 0 };
  }
}

/**
 * Get information about all currently scheduled tasks
 * Useful for debugging and monitoring
 */
export function getScheduledTasks(): Array<{ workerId: string; cronExpression: string }> {
  return Array.from(scheduledTasks.values()).map(({ workerId, cronExpression }) => ({
    workerId,
    cronExpression,
  }));
}
