  import type { Worker, WorkerType } from '@/types/worker';
  import { generateWorkerConfig } from '@/lib/creation';
  import { getServerSession } from 'next-auth';
  import { authOptions } from '@/app/api/auth/[...nextauth]/route';
  import { prisma } from '@/lib/prisma';


  export async function POST(req: Request) {

    // 1. checking auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return Response.json({ message: "Not authenticated" }, { status: 401 });
    }

    // 2. gert user from db (NextAuth will create this automatically when someone signs up)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });
    if (!user) {
      return Response.json({ message: "User not found" }, { status: 404 });
    }

    // 3. get description and type from request body
    const { description, type, name } = await req.json();
    const configuration = await generateWorkerConfig(description, type);

    // 4. Save to database
    const worker = await prisma.worker.create({
      data: {
        userId: user.id,
        name: name || description.slice(0, 50),
        type: type,
        configuration: JSON.stringify(configuration),
      },
    });

    // return response
    return Response.json({
      configuration,
      message: "WORKER SAVED TO DATABASE",
      worker,
    });
  }