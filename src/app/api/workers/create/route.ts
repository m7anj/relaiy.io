  import type { Worker, WorkerType } from '@/types/worker';
  import { generateWorkerConfig } from '@/lib/creation';

  export async function POST(req: Request) {

    const { description, type } = await req.json();
    const configuration = await
    generateWorkerConfig(description, type);

    // TODO: Save to database (currently in-memory)
    return Response.json({
      configuration,
      message: "Config generated, not saved yet"
    });
  }