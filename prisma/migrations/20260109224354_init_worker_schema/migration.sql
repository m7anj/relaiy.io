-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('OUTREACH', 'NURTURE', 'RESPONDER', 'DIGEST');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SUCCESS', 'ERROR', 'RUNNING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "gmailAccessToken" TEXT,
    "gmailRefreshToken" TEXT,
    "gmailTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "WorkerType" NOT NULL,
    "information" TEXT[],
    "status" "WorkerStatus" NOT NULL DEFAULT 'DRAFT',
    "lastExecutionStatus" "ExecutionStatus",
    "configuration" JSONB NOT NULL,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_executions" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "affectedEmails" JSONB NOT NULL,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "actionsPerformed" JSONB NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "error" TEXT,
    "errorStack" TEXT,
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "worker_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "workers_userId_status_idx" ON "workers"("userId", "status");

-- CreateIndex
CREATE INDEX "worker_executions_workerId_executedAt_idx" ON "worker_executions"("workerId", "executedAt");

-- CreateIndex
CREATE INDEX "worker_executions_status_idx" ON "worker_executions"("status");

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_executions" ADD CONSTRAINT "worker_executions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
