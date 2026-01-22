import { getAuthenticatedUser } from "@/lib/auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Configuration } from "@/types/configuration";
import { executeWorker, registerWorker } from "@/lib/scheduler";
import { validateGoogleToken, getTokenInfo } from "@/lib/tokenValidator";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workerId } = await params;

  // 1. Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({
      message: "Not authenticated. Your session may have expired. Please sign out and sign back in.",
      action: "SIGN_OUT_REQUIRED"
    }, { status: 401 });
  }

  // 2. Get access token
  const accessToken = user.accounts[0]?.access_token;
  if (!accessToken) {
    return Response.json({
      message: "No Google account connected. Please reconnect your Google account.",
      action: "RECONNECT_REQUIRED"
    }, { status: 400 });
  }

  // 3. Validate token before using it
  console.log('[Execute Worker] Validating access token...');
  const isValid = await validateGoogleToken(accessToken);
  if (!isValid) {
    console.error('[Execute Worker] Token validation failed, fetching token info...');
    const tokenInfo = await getTokenInfo(accessToken);
    console.error('[Execute Worker] Token info:', tokenInfo);

    return Response.json({
      message: "Your Google access token is invalid or expired. Please sign out and sign back in.",
      action: "SIGN_OUT_REQUIRED",
      debug: {
        tokenInfo,
        expiresAt: user.accounts[0]?.expires_at
          ? new Date(user.accounts[0].expires_at * 1000).toISOString()
          : 'unknown'
      }
    }, { status: 401 });
  }
  console.log('[Execute Worker] Token validation successful');

  try {
    // 4. Verify worker exists and belongs to user
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        userId: true,
        name: true,
        status: true,
        configuration: true,
      },
    });

    if (!worker) {
      return Response.json({ message: "Worker not found" }, { status: 404 });
    }

    if (worker.userId !== user.id) {
      return Response.json(
        { message: "Not authorized to execute this worker" },
        { status: 403 }
      );
    }

    // 5. Check if worker can be executed
    if (worker.status !== "ACTIVE" && worker.status !== "DRAFT") {
      return Response.json(
        { message: `Cannot execute worker with status: ${worker.status}` },
        { status: 400 }
      );
    }

    const config = worker.configuration as unknown as Configuration;

    // 6. Parse optional dryRun flag from request body
    const body = await req.json().catch(() => ({}));
    const isDryRun = body.isDryRun || false;

    // 7. Check if this is the first execution (DRAFT -> ACTIVE transition)
    const isFirstExecution = worker.status === "DRAFT";

    // 8. If first execution and not a dry run, activate worker and register with scheduler
    if (isFirstExecution && !isDryRun) {
      // Update status to ACTIVE
      await prisma.worker.update({
        where: { id: workerId },
        data: { status: "ACTIVE" },
      });

      // Register with cron scheduler for automated future executions
      const registered = registerWorker(workerId, config.interval);

      if (!registered) {
        console.error(`Failed to register worker ${workerId} with scheduler`);
        // Continue with execution anyway, manual execution still works
      } else {
        console.log(`Worker ${workerId} activated and registered with scheduler`);
      }
    }

    // 9. Execute the worker using the scheduler's executeWorker function
    const result = await executeWorker(workerId, isDryRun);

    if (result.success) {
      return Response.json({
        message: isDryRun
          ? "Dry run completed successfully"
          : isFirstExecution
            ? "First execution completed successfully. Worker is now ACTIVE and scheduled for automated runs."
            : "Execution completed successfully",
        executionId: result.executionId,
        isFirstExecution,
        status: isFirstExecution ? "ACTIVE" : worker.status,
        scheduledInterval: isFirstExecution ? config.interval : undefined,
        isDryRun,
      });
    } else {
      console.error(`[Execute Worker] Worker ${workerId} execution failed:`, result.error);
      return Response.json(
        {
          message: "Execution failed",
          executionId: result.executionId,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Execute Worker] Failed to execute worker ${workerId}:`, errorMessage, errorStack);
    return Response.json(
      { message: "Failed to execute worker", error: errorMessage },
      { status: 500 }
    );
  }
}
