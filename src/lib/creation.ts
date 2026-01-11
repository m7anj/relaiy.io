import { Configuration } from "@/types/configuration";
import { WorkerType } from "@/types/worker";
import { z } from "zod";
import OpenAI from "openai";

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  type: WorkerType
): Promise<Configuration> {
  try {
    const systemPrompt = SYSTEM_PROMPTS[type];

    const userPrompt = `
User's description: "${naturalLanguagePrompt}"

Generate a valid Configuration JSON object with these fields:
- interval (string): When to send (e.g., "daily at 9am", "every Monday", "every 3 days")
- recipients (string[]): Email addresses to send to
- contextEmails (optional): { labels?: string[], from?: string[], limit?: number }
- tone (optional): "professional", "casual", "friendly", "formal"
- style (optional): "brief", "detailed", "creative"
- customInstructions (optional): Additional instructions for email generation
- subjectTemplate (optional): Template for subject line, or null for LLM to decide
- lifespan (optional): How many times to send before stopping (default: 1)

Return ONLY the JSON object, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const validated = ConfigurationSchema.parse(parsed);

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration generated: ${error.message}`);
    }
    throw error;
  }
}
