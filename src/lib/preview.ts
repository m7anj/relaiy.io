import { Configuration } from "@/types/configuration";
import { WorkerType } from "@/types/worker";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
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
  contextEmails?: Array<{ snippet?: string; subject?: string }>,
  conversationHistory?: Array<{ recipient: string; subject: string; body: string; sentAt: string }>
): Promise<EmailPreview[]> {
  const previews: EmailPreview[] = [];

  // Generate email content based on worker type
  const systemPrompt = getSystemPromptForType(workerType);

  for (const recipient of config.recipients) {
    // Build context for LLM
    const contextInfo = contextEmails && contextEmails.length > 0
      ? `Context from recent emails:\n${contextEmails.map(e => `- ${e.subject}: ${e.snippet}`).join('\n')}`
      : 'No context emails provided.';

    // Build conversation history for this recipient
    const recipientHistory = conversationHistory?.filter(h => h.recipient === recipient) || [];
    const historyInfo = recipientHistory.length > 0
      ? `
Previous emails sent to ${recipient}:
${recipientHistory.map((h, i) => `
Email ${i + 1} (sent ${new Date(h.sentAt).toLocaleDateString()}):
Subject: ${h.subject}
Body: ${h.body}
`).join('\n---\n')}

IMPORTANT: This is email #${recipientHistory.length + 1} in the conversation. Vary the content, approach, and phrasing to avoid repetition. Reference or build upon previous emails naturally if appropriate for the worker type.`
      : `This is the first email to ${recipient}.`;

    const userPrompt = `
Generate an email with the following requirements:
- Recipient: ${recipient}
- Tone: ${config.tone || "professional"}
- Style: ${config.style || "brief"}
- Custom Instructions: ${config.customInstructions || "None"}
${config.subjectTemplate ? `- Subject Template: ${config.subjectTemplate}` : '- Generate an appropriate subject line'}

${contextInfo}

${historyInfo}

Return a JSON object with:
{
  "subject": "the subject line",
  "body": "the email body"
}
`;

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        // Higher temperature for more variation when history exists
        temperature: recipientHistory.length > 0 ? 0.9 : 0.7,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("No response from Groq");
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
- Avoid being overly salesy or aggressive

CRITICAL: If previous emails are provided, you MUST vary your approach:
- Use different opening lines and hooks
- Vary your value propositions and angles
- Reference previous touchpoints naturally
- Try different CTAs if previous ones haven't been answered
- Adjust tone based on lack of response (slightly more direct or different angle)`,

    [WorkerType.NURTURE]: `You are an expert at writing relationship-building emails. Generate warm, conversational emails that:
- Maintain existing relationships
- Show genuine interest and care
- Include personal touches when appropriate
- Are friendly without being too informal

CRITICAL: If previous emails are provided, you MUST create natural progression:
- Reference or acknowledge previous conversations naturally
- Vary topics and questions to keep engagement fresh
- Show you remember past interactions
- Build on previous discussions organically
- Avoid repeating the same greetings or sign-offs`,

    [WorkerType.RESPONDER]: `You are an expert at writing automated responses. Generate helpful, timely responses that:
- Address the recipient's likely concerns
- Provide clear next steps or information
- Maintain a helpful and professional tone
- Are concise and to the point

CRITICAL: If previous responses are provided, you MUST:
- Ensure each response feels contextually appropriate
- Vary phrasing and structure between responses
- Maintain consistency in information while varying delivery`,

    [WorkerType.DIGEST]: `You are an expert at writing email digests. Generate clear summaries that:
- Highlight key information from multiple sources
- Are well-organized and scannable
- Provide context when needed
- Are concise and easy to read

CRITICAL: If previous digests are provided, you MUST:
- Vary the format and structure (bullets, numbered lists, sections)
- Use different section headers and organization methods
- Adjust summary depth based on information density
- Keep each digest feeling fresh and engaging`,
  };

  return prompts[type];
}
