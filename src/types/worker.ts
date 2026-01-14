import { Configuration } from "./configuration";

// worker lifecycle status - is it actively running?
export enum WorkerStatus {
  ACTIVE = "ACTIVE",       // worker is enabled and will execute on schedule
  PAUSED = "PAUSED",       // worker is paused by user
  STOPPED = "STOPPED",     // worker has been permanently stopped (hit stop conditions)
  DRAFT = "DRAFT",         // worker is being configured, not yet activated
}

// execution status - how did the last run go?
export enum ExecutionStatus {
  SUCCESS = "SUCCESS",     // last execution succeeded
  ERROR = "ERROR",         // last execution failed
  RUNNING = "RUNNING",     // last execution is still running
}

// worker types define different behaviors and LLM instructions
export enum WorkerType {              
    OUTREACH = "OUTREACH",      // sends an email to a list of recipients you feed it
    NURTURE = "NURTURE",        // sends conversational-style emails, mainly to facilitate a relationship or a connection, nothing else
    RESPONDER = "RESPONDER",    // responds to emails from the recipients you feed it
    DIGEST = "DIGEST",          // digests emails and summarize them into a single email, either send it back to yourself for summary OR another recipient
}

// Worker type matches the shape returned from Prisma
export interface Worker {
  // Identity
  id: string;
  userId: string;                      // who owns this worker
  name: string;                        // user-friendly name
  description?: string | null;         // optional user notes

  // Type & behavior
  type: WorkerType;                     // determines LLM behavior and defaults
  information?: string[];              // additional context for LLM

  // Configuration stored as JSON in DB
  configuration: Configuration;        // the actual worker config

  // Status tracking
  status: WorkerStatus;                // lifecycle status
  lastExecutionStatus?: ExecutionStatus | null; // how the last run went

  // Execution tracking
  executionCount: number;              // how many times this worker has done something
  lastExecutedAt?: Date | null;       // when it last ran
  nextScheduledAt?: Date | null;      // when it will run next

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export { WorkerStatus as STATUS, WorkerType as WORKER_TYPE };
 