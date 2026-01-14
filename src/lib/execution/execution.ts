    import type { Worker, WorkerType } from '@/types/worker';
    import type { Configuration } from '@/types/configuration';
    import { generateWorkerConfig } from '@/lib/creation';
    import { getServerSession } from 'next-auth';
    import { authOptions } from '@/app/api/auth/[...nextauth]/route';
    import { prisma } from '@/lib/prisma';

    // 1. fetching the worker from the database with proper typing
    async function fetchWorker(workerId: string): Promise<Worker | null> {
        const dbWorker = await prisma.worker.findUnique({
            where: { id: workerId },
        });

        if (!dbWorker) return null;

        // Cast Prisma's Json type to our Configuration interface
        const configuration = dbWorker.configuration as unknown as Configuration;

        // Map Prisma worker to our Worker type
        return {
            id: dbWorker.id,
            userId: dbWorker.userId,
            name: dbWorker.name,
            description: dbWorker.description,
            type: dbWorker.type as WorkerType,
            information: dbWorker.information,
            configuration,
            status: dbWorker.status as any,
            lastExecutionStatus: dbWorker.lastExecutionStatus as any,
            executionCount: dbWorker.executionCount,
            lastExecutedAt: dbWorker.lastExecutedAt,
            nextScheduledAt: dbWorker.nextScheduledAt,
            createdAt: dbWorker.createdAt,
            updatedAt: dbWorker.updatedAt,
        };
    }

    // 2. TODO: fetch relevant emails from Gmail based on worker config
