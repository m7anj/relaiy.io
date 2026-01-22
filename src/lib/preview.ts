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
    const recipientHistory = conversationHistory?.filter(h =>
      h.recipient === recipient || h.recipient.includes(recipient)
    ) || [];

    const historyInfo = recipientHistory.length > 0
      ? `
CONVERSATION HISTORY with ${recipient}:
${recipientHistory.map((h, i) => {
  // Try to determine if this was sent by you or received from them
  const direction = h.body.includes(config.senderName || '') ? 'YOU sent' : 'THEY sent';
  return `
${direction} (${new Date(h.sentAt).toLocaleDateString()}):
Subject: ${h.subject}
Body: ${h.body.substring(0, 500)}${h.body.length > 500 ? '...' : ''}
`;
}).join('\n---\n')}

IMPORTANT: This is email #${recipientHistory.length + 1} in the conversation.
- Pay attention to what THEY said in their responses
- Reference their questions, concerns, or comments naturally
- Vary the content, approach, and phrasing to avoid repetition
- Build upon the conversation thread contextually
- If they haven't responded yet, try a different angle or approach`
      : `This is the first email to ${recipient} in this conversation thread.`;

    const userPrompt = `
Generate an email with the following requirements:
- Recipient: ${recipient}
${config.senderName ? `- Sender Name: ${config.senderName} (use this for personalization and signatures)` : ''}
- Tone: ${config.tone || "professional"}
- Style: ${config.style || "professional"}
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
    [WorkerType.OUTREACH]: `You are an expert at writing cold outreach emails.

STYLE GUIDELINES:
- "super-human": Exceptionally polished, warm yet professional, uses perfect structure and compelling language
- "professional": Clear, business-appropriate, focused and effective
- "concise": Brief, direct, gets to the point quickly

Generate emails that:
- Have a clear value proposition
- Include a specific call-to-action
- Are respectful of the recipient's time
- Avoid being overly salesy or aggressive

CRITICAL: If previous emails or responses are provided, you MUST:
- Pay close attention to what the recipient said in their replies
- Address their questions, concerns, or objections directly
- Use different opening lines and hooks
- Vary your value propositions and angles
- Try different CTAs if previous ones haven't been answered
- Adjust tone based on their responses or lack thereof`,

    [WorkerType.NURTURE]: `You are an expert at writing relationship-building emails.

STYLE GUIDELINES:
- "super-human": Exceptionally warm, shows genuine care, perfectly personalized
- "professional": Friendly yet appropriate, maintains professional boundaries
- "concise": Brief check-ins, warm but efficient

Generate emails that:
- Maintain existing relationships
- Show genuine interest and care
- Include personal touches when appropriate
- Are friendly without being too informal

CRITICAL: If previous emails or responses are provided, you MUST:
- Reference what they shared in their replies
- Acknowledge their updates, concerns, or news
- Vary topics and questions to keep engagement fresh
- Show you remember past interactions and build on them
- Respond to their questions or comments naturally
- Avoid repeating the same greetings or sign-offs`,

    [WorkerType.RESPONDER]: `You are an expert at writing automated responses.

STYLE GUIDELINES:
- "super-human": Exceptionally helpful, anticipates needs, warm and thorough
- "professional": Clear, efficient, appropriately formal
- "concise": Quick acknowledgment, brief next steps

Generate responses that:
- Address the recipient's likely concerns
- Provide clear next steps or information
- Maintain a helpful and professional tone

CRITICAL: If previous responses are provided, you MUST:
- Ensure each response feels contextually appropriate
- Vary phrasing and structure between responses
- Maintain consistency in information while varying delivery`,

    [WorkerType.DIGEST]: `You are an expert at writing email digests.

STYLE GUIDELINES:
- "super-human": Beautifully organized, insightful summaries with key takeaways
- "professional": Clear structure, well-organized information
- "concise": Bulleted highlights, scannable format

Generate digests that:
- Highlight key information from multiple sources
- Are well-organized and scannable
- Provide context when needed

CRITICAL: If previous digests are provided, you MUST:
- Vary the format and structure (bullets, numbered lists, sections)
- Use different section headers and organization methods
- Adjust summary depth based on information density
- Keep each digest feeling fresh and engaging`,
  };

  return prompts[type];
}
