
  import type { Worker, WorkerType } from '@/types/worker';
  import { generateWorkerConfig } from '@/lib/creation';
  import { getAuthenticatedUser } from '@/lib/auth';
  import { prisma } from '@/lib/prisma';

  export async function POST(req: Request) {

    // 1. checking auth using reusable helper
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ message: "Not authenticated" }, { status: 401 });
    }

    // 2. get description and type from request body
    const { description, type, name } = await req.json();
    const configuration = await generateWorkerConfig(description, type);

    // 3. Save to database
    const worker = await prisma.worker.create({
    data: {
      // id: handled by prisma anyways
      userId: user.id,
      name: name || description.slice(0, 50),
      description,
      type,
      configuration: configuration as any, // Prisma expects InputJsonValue, cast to satisfy types
    },
  });

    // return response
    return Response.json({
      configuration,
      message: "WORKER SAVED TO DATABASE",
      worker,
    });
  }