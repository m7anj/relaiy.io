import { getAuthenticatedUser } from "@/lib/auth";
import { fetchEmailsFromRecipients, sendEmail } from "@/lib/gmail";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ExecutionStatus, Prisma } from "@/generated/prisma";
import { Configuration } from "@/types/configuration";

interface ExecutionAction {
  action: "email_sent" | "email_simulated";
  recipient: string;
  subject: string;
  timestamp: string;
  result: "sent" | "dry_run";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workerId } = await params;
  const startTime = Date.now();

  // 1. Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. Get access token
  const accessToken = user.accounts[0]?.access_token;
  if (!accessToken) {
    return Response.json({ message: "No Google account connected" }, { status: 400 });
  }

  try {
    // 3. Verify worker exists and belongs to user
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        userId: true,
        name: true,
        type: true,
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

    if (worker.status !== "ACTIVE" && worker.status !== "DRAFT") {
      return Response.json(
        { message: `Cannot execute worker with status: ${worker.status}` },
        { status: 400 }
      );
    }

    const config = worker.configuration as unknown as Configuration;

    // 4. Parse optional dryRun flag from request body
    const body = await req.json().catch(() => ({}));
    const isDryRun = body.isDryRun || false;

    // 5. Create initial execution log with RUNNING status
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
      let contextEmails: Array<{ id?: string | null }> = [];
      if (config.contextEmails?.from && config.contextEmails.from.length > 0) {
        contextEmails = await fetchEmailsFromRecipients(
          accessToken,
          config.contextEmails.from
        );
        affectedEmails.push(...contextEmails.map((email) => email.id || "unknown"));
      }

      // Generate email content (placeholder for now - will integrate with LLM later)
      const subject = config.subjectTemplate || `Message from ${worker.name}`;
      const body = `This is an automated email from ${worker.name}.\n\nTone: ${config.tone || "professional"}\nStyle: ${config.style || "brief"}`;

      // Send email to recipients
      for (const recipient of config.recipients) {
        const result = await sendEmail(
          accessToken,
          [recipient],
          subject,
          body,
          isDryRun
        );

        actionsPerformed.push({
          action: isDryRun ? "email_simulated" : "email_sent",
          recipient,
          subject,
          timestamp: new Date().toISOString(),
          result: isDryRun ? "dry_run" : "sent",
        });
      }

      // 7. Update execution to SUCCESS
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

      return Response.json({
        message: isDryRun ? "Dry run completed successfully" : "Execution completed successfully",
        executionId: execution.id,
        emailCount: affectedEmails.length,
        actionCount: actionsPerformed.length,
        duration,
        isDryRun,
      });
    } catch (executionError) {
      // 8. Update execution to ERROR on failure
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

      return Response.json(
        {
          message: "Execution failed",
          executionId: execution.id,
          error: errorMessage,
          duration,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json(
      { message: "Failed to execute worker", error: errorMessage },
      { status: 500 }
    );
  }
}
