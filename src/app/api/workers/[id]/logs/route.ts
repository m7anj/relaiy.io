import { getAuthenticatedUser } from "@/lib/auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, ExecutionStatus } from "@/generated/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // from URL
) {
  const { id: workerId } = await params; // resolving that promise

  // 1. Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    // 2. Verify worker exists and belongs to user
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { userId: true },
    });

    if (!worker) {
      return Response.json({ message: "Worker not found" }, { status: 404 });
    }

    if (worker.userId !== user.id) {
      return Response.json(
        { message: "Not authorized to access this worker" },
        { status: 403 }
      );
    }

    // 3. Parse query parameters for pagination
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status"); // Optional filter by status

    // 4. Build query filter
    const where: Prisma.WorkerExecutionWhereInput = { workerId };
    if (status && ["SUCCESS", "ERROR", "RUNNING"].includes(status)) {
      where.status = status as ExecutionStatus;
    }

    // 5. Fetch execution logs with pagination
    const [executions, totalCount] = await Promise.all([
      prisma.workerExecution.findMany({
        where,
        orderBy: { executedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          worker: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      }) as Promise<
        Array<
          Prisma.WorkerExecutionGetPayload<{
            include: {
              worker: {
                select: {
                  id: true;
                  name: true;
                  type: true;
                };
              };
            };
          }>
        >
      >,
      prisma.workerExecution.count({ where }),
    ]);

    // 6. Return execution logs with metadata
    return Response.json({
      executions: executions.map((execution) => ({
        id: execution.id,
        workerId: execution.workerId,
        worker: execution.worker,
        status: execution.status,
        affectedEmails: execution.affectedEmails,
        emailCount: execution.emailCount,
        actionsPerformed: execution.actionsPerformed,
        executedAt: execution.executedAt,
        duration: execution.duration,
        error: execution.error,
        errorStack: execution.errorStack,
        isDryRun: execution.isDryRun,
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    return Response.json(
      { message: "Failed to fetch execution logs", error: error },
      { status: 500 }
    );
  }
}




// POST function to store an execution's details on the database.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params;

  // 1. Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    // 2. Parse request body
    const body = await req.json();
    const {
      status,
      affectedEmails = [],
      emailCount = 0,
      actionsPerformed = [],
      duration,
      error,
      errorStack,
      isDryRun = false,
    } = body;

    // 3. Validate required fields
    if (!status || !["SUCCESS", "ERROR", "RUNNING"].includes(status)) {
      return Response.json(
        { message: "Invalid status. Must be SUCCESS, ERROR, or RUNNING" },
        { status: 400 }
      );
    }

    // 4. Verify worker exists and belongs to user
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { userId: true, executionCount: true },
    });

    if (!worker) {
      return Response.json({ message: "Worker not found" }, { status: 404 });
    }

    if (worker.userId !== user.id) {
      return Response.json(
        { message: "Not authorized to access this worker" },
        { status: 403 }
      );
    }

    // 5. Create execution log and update worker in a transaction
    const [execution] = await prisma.$transaction([
      // Create execution log
      prisma.workerExecution.create({
        data: {
          workerId,
          status: status as ExecutionStatus,
          affectedEmails,
          emailCount,
          actionsPerformed,
          duration,
          error,
          errorStack,
          isDryRun,
        },
      }),
      // Update worker execution tracking
      prisma.worker.update({
        where: { id: workerId },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
          lastExecutionStatus: status as ExecutionStatus,
        },
      }),
    ]);

    return Response.json(
      {
        message: "Execution logged successfully",
        execution: {
          id: execution.id,
          workerId: execution.workerId,
          status: execution.status,
          affectedEmails: execution.affectedEmails,
          emailCount: execution.emailCount,
          actionsPerformed: execution.actionsPerformed,
          executedAt: execution.executedAt,
          duration: execution.duration,
          error: execution.error,
          isDryRun: execution.isDryRun,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { message: "Failed to create execution log", error: error },
      { status: 500 }
    );
  }
}
