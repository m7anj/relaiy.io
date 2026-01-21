import { Configuration } from "@/types/configuration";
import { WorkerType } from "@/types/worker";
import { z } from "zod";
import Groq from "groq-sdk";

// Zod schema to validate LLM output matches Configuration interface
const ConfigurationSchema = z.object({
  interval: z.string(),
  recipients: z.array(z.string().email()),
  contextEmails: z.object({
    labels: z.array(z.string()).optional(),
    from: z.array(z.string()).optional(),
    limit: z.number().optional(),
  }).optional(),
  tone: z.string().optional(),
  style: z.string().optional(),
  customInstructions: z.string().optional(),
  subjectTemplate: z.string().nullable().optional(),
  lifespan: z.number().optional(),
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Normalize LLM output to ensure it matches our schema
 * Handles cases where LLM returns arrays instead of strings, etc.
 */
function normalizeConfiguration(data: any): any {
  const normalized = { ...data };

  // Ensure customInstructions is a string (not an array)
  if (Array.isArray(normalized.customInstructions)) {
    normalized.customInstructions = normalized.customInstructions.join(". ");
  }

  // Ensure information is an array if it exists
  if (normalized.information && !Array.isArray(normalized.information)) {
    normalized.information = [normalized.information];
  }

  // Ensure recipients is always an array
  if (normalized.recipients && !Array.isArray(normalized.recipients)) {
    normalized.recipients = [normalized.recipients];
  }

  return normalized;
}

// Type-specific system prompts
const SYSTEM_PROMPTS: Record<WorkerType, string> = {
  [WorkerType.OUTREACH]: `You are an expert at configuring email outreach campaigns. Generate a Configuration JSON that:
- Sets appropriate sending intervals for cold outreach (not too aggressive)
- Focuses on professional, clear tone
- Includes reasonable lifespan limits to avoid spam
- Returns ONLY valid JSON matching the Configuration schema`,

  [WorkerType.NURTURE]: `You are an expert at configuring relationship-building email campaigns. Generate a Configuration JSON that:
- Sets intervals suitable for maintaining relationships (weekly/monthly)
- Emphasizes warm, conversational tone
- May have longer lifespans for ongoing relationship building
- Returns ONLY valid JSON matching the Configuration schema`,

  [WorkerType.RESPONDER]: `You are an expert at configuring automated email responses. Generate a Configuration JSON that:
- Sets immediate or near-immediate response intervals
- Matches the tone to the incoming emails
- Typically has unlimited lifespan (lifespan: 999 or similar)
- Returns ONLY valid JSON matching the Configuration schema`,

  [WorkerType.DIGEST]: `You are an expert at configuring email digest systems. Generate a Configuration JSON that:
- Sets intervals appropriate for summaries (daily/weekly)
- Uses clear, concise style
- May include contextEmails to specify what to digest
- Returns ONLY valid JSON matching the Configuration schema`,
};

export async function generateWorkerConfig(
  naturalLanguagePrompt: string,
  type: WorkerType,
  context?: string[],
): Promise<Configuration> {
  try {
    const systemPrompt = SYSTEM_PROMPTS[type];
    const userPrompt = `
User's description: "${naturalLanguagePrompt}"
User's context: "${context ? context.join(',') : 'No Context'}"

Generate a valid Configuration JSON object with these fields:
- interval (string): When to send (e.g., "daily at 9am", "every Monday", "every 3 days")
- recipients (string[]): Array of email addresses to send to
- contextEmails (optional object): { labels?: string[], from?: string[], limit?: number }
- tone (optional string): "professional", "casual", "friendly", or "formal"
- style (optional string): "brief", "detailed", or "creative"
- customInstructions (optional string): Single string with additional instructions for email generation
- subjectTemplate (optional string or null): Template for subject line, or null for LLM to decide
- lifespan (optional number): How many times to send before stopping (default: 1)

IMPORTANT:
- customInstructions must be a STRING, not an array
- All text fields must be strings, not arrays
- Return ONLY the JSON object, no explanation.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No response from Groq");
    }

    const parsed = JSON.parse(content);

    // Normalize the parsed data before validation
    const normalized = normalizeConfiguration(parsed);
    const validated = ConfigurationSchema.parse(normalized);

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration generated: ${error.message}`);
    }
    throw error;
  }
}
