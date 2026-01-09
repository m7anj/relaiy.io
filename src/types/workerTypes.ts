import { WorkerType } from "./worker";
import Configuration from "./configuration";

// Type-specific LLM prompts and default configs

export interface WorkerTypeConfig {
  systemPrompt: string;
  defaultConfig: Partial<Configuration>;
  description: string;
}

export const WORKER_TYPE_CONFIGS: Record<WorkerType, WorkerTypeConfig> = {
  [WorkerType.OUTREACH]: {
    description: "Cold emails with clear calls-to-action",
    systemPrompt: "Write a concise cold outreach email. Be professional, state purpose quickly, include ONE clear call-to-action. Under 150 words.",
    defaultConfig: {
      tone: "professional",
      style: "brief",
      maxExecutions: 1,
      stopIfReplied: true,
    },
  },

  [WorkerType.NURTURE]: {
    description: "Warm relationship check-ins",
    systemPrompt: "Write a warm, conversational email to maintain a relationship. Reference past context, be genuine, don't push for anything specific.",
    defaultConfig: {
      tone: "friendly",
      style: "casual",
      contextEmails: { limit: 10 },
    },
  },

  [WorkerType.RESPONDER]: {
    description: "Auto-replies to incoming emails",
    systemPrompt: "Write a quick, helpful auto-reply. Be accurate, professional but not robotic. Brief and actionable.",
    defaultConfig: {
      tone: "professional",
      style: "brief",
      maxExecutions: 1,
      contextEmails: { limit: 3 },
    },
  },

  [WorkerType.DIGEST]: {
    description: "Summarize multiple emails into one",
    systemPrompt: "Create an email digest. Synthesize multiple emails into organized bullet points. Highlight key info and action items.",
    defaultConfig: {
      tone: "professional",
      style: "detailed",
      contextEmails: { limit: 50 },
      subject: "Email Digest",
    },
  },
};

export function getDefaultConfigForType(type: WorkerType): Partial<Configuration> {
  return WORKER_TYPE_CONFIGS[type].defaultConfig;
}

export function getSystemPromptForType(type: WorkerType): string {
  return WORKER_TYPE_CONFIGS[type].systemPrompt;
}
