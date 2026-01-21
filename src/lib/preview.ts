import { Configuration } from "@/types/configuration";
import { WorkerType } from "@/types/worker";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EmailPreview {
  recipient: string;
  subject: string;
  body: string;
}

/**
 * Generate preview emails for a worker configuration
 * Shows what emails would look like without actually sending them
 */
export async function generateEmailPreviews(
  config: Configuration,
  workerType: WorkerType,
  workerName: string,
  contextEmails?: Array<{ snippet?: string; subject?: string }>
): Promise<EmailPreview[]> {
  const previews: EmailPreview[] = [];

  // Generate email content based on worker type
  const systemPrompt = getSystemPromptForType(workerType);

  for (const recipient of config.recipients) {
    // Build context for LLM
    const contextInfo = contextEmails && contextEmails.length > 0
      ? `Context from recent emails:\n${contextEmails.map(e => `- ${e.subject}: ${e.snippet}`).join('\n')}`
      : 'No context emails provided.';

    const userPrompt = `
Generate an email with the following requirements:
- Recipient: ${recipient}
- Tone: ${config.tone || "professional"}
- Style: ${config.style || "brief"}
- Custom Instructions: ${config.customInstructions || "None"}
${config.subjectTemplate ? `- Subject Template: ${config.subjectTemplate}` : '- Generate an appropriate subject line'}

${contextInfo}

Return a JSON object with:
{
  "subject": "the subject line",
  "body": "the email body"
}
`;

    try {
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
      previews.push({
        recipient,
        subject: parsed.subject || config.subjectTemplate || `Message from ${workerName}`,
        body: parsed.body || "Email content could not be generated.",
      });
    } catch (error) {
      // Fallback to template-based preview if LLM fails
      previews.push({
        recipient,
        subject: config.subjectTemplate || `Message from ${workerName}`,
        body: `This is a preview of an automated email from ${workerName}.\n\nTone: ${config.tone || "professional"}\nStyle: ${config.style || "brief"}\n\n${config.customInstructions || ""}`,
      });
    }
  }

  return previews;
}

function getSystemPromptForType(type: WorkerType): string {
  const prompts: Record<WorkerType, string> = {
    [WorkerType.OUTREACH]: `You are an expert at writing cold outreach emails. Generate professional, clear emails that:
- Have a clear value proposition
- Include a specific call-to-action
- Are concise and respectful of the recipient's time
- Avoid being overly salesy or aggressive`,

    [WorkerType.NURTURE]: `You are an expert at writing relationship-building emails. Generate warm, conversational emails that:
- Maintain existing relationships
- Show genuine interest and care
- Include personal touches when appropriate
- Are friendly without being too informal`,

    [WorkerType.RESPONDER]: `You are an expert at writing automated responses. Generate helpful, timely responses that:
- Address the recipient's likely concerns
- Provide clear next steps or information
- Maintain a helpful and professional tone
- Are concise and to the point`,

    [WorkerType.DIGEST]: `You are an expert at writing email digests. Generate clear summaries that:
- Highlight key information from multiple sources
- Are well-organized and scannable
- Provide context when needed
- Are concise and easy to read`,
  };

  return prompts[type];
}
