import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { registerWorker, unregisterWorker } from '@/lib/scheduler';
import { Configuration } from '@/types/configuration';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params;

  // 1. checking auth using reusable helper
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. fetch the specific worker from database
  try {
    const worker = await prisma.worker.findUnique({
      where: {
        id: workerId,
      },
    });

    // 3. check if worker exists
    if (!worker) {
      return Response.json({ message: "Worker not found" }, { status: 404 });
    }

    // 4. verify ownership - ensure this worker belongs to the authenticated user
    if (worker.userId !== user.id) {
      return Response.json({ message: "Forbidden - Not your worker" }, { status: 403 });
    }

    // 5. return the worker
    return Response.json({ worker });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params;

  // 1. checking auth using reusable helper
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. get update data from request body
  const body = await req.json();

  // 3. verify the worker exists and belongs to this user
  try {
    const existingWorker = await prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!existingWorker) {
      return Response.json({ message: "Worker not found" }, { status: 404 });
    }

    if (existingWorker.userId !== user.id) {
      return Response.json({ message: "Forbidden - Not your worker" }, { status: 403 });
    }

    // 4. update the worker with allowed fields only
    // only allow updating specific fields to prevent overwriting critical data

    // If recipients are provided, merge them into the existing configuration
    let updatedConfiguration = existingWorker.configuration;
    if (body.recipients !== undefined && Array.isArray(body.recipients)) {
      updatedConfiguration = {
        ...(existingWorker.configuration as object),
        recipients: body.recipients,
      };
    } else if (body.configuration !== undefined) {
      updatedConfiguration = body.configuration;
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: workerId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.information !== undefined && { information: body.information }),
        ...(updatedConfiguration !== existingWorker.configuration && { configuration: updatedConfiguration as any }),
      },
    });

    // 5. Handle scheduler registration based on status changes
    if (body.status !== undefined) {
      const newStatus = body.status;
      const config = updatedWorker.configuration as unknown as Configuration;

      if (newStatus === 'ACTIVE') {
        // Register with scheduler when activated
        registerWorker(workerId, config.interval);
      } else if (newStatus === 'PAUSED' || newStatus === 'STOPPED') {
        // Unregister from scheduler when paused or stopped
        unregisterWorker(workerId);
      }
    }

    // 6. If configuration.interval changed and worker is ACTIVE, re-register
    if (body.configuration !== undefined && updatedWorker.status === 'ACTIVE') {
      const config = updatedWorker.configuration as unknown as Configuration;
      unregisterWorker(workerId);
      registerWorker(workerId, config.interval);
    }

    // 7. return the updated worker
    return Response.json({
      message: "Worker updated successfully",
      worker: updatedWorker,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params;

  // 1. checking auth using reusable helper
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. verify the worker exists and belongs to this user before deleting
  try {
    const existingWorker = await prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!existingWorker) {
      return Response.json({ message: "Worker not found" }, { status: 404 });
    }

    if (existingWorker.userId !== user.id) {
      return Response.json({ message: "Forbidden - Not your worker" }, { status: 403 });
    }

    // 3. unregister from scheduler if it's registered
    unregisterWorker(workerId);

    // 4. delete the worker (cascade will delete related executions)
    await prisma.worker.delete({
      where: { id: workerId },
    });

    // 5. return success message
    return Response.json({
      message: "Worker deleted successfully",
      deletedWorkerId: workerId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
