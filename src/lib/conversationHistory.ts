import { google } from 'googleapis';
import { getGmailClient } from './gmail';

export interface ConversationEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  timestamp: string;
  direction: 'sent' | 'received';
}

/**
 * Fetch complete conversation history with specific recipients
 * Includes both emails sent TO recipients and received FROM recipients
 */
export async function fetchConversationWithRecipients(
  accessToken: string,
  recipients: string[],
  limit: number = 10
): Promise<ConversationEmail[]> {
  const gmail = getGmailClient(accessToken);
  const conversations: ConversationEmail[] = [];

  for (const recipient of recipients) {
    try {
      // Build query to get emails to/from this recipient
      const query = `(from:${recipient} OR to:${recipient})`;

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: limit,
      });

      const messages = response.data.messages || [];

      for (const message of messages) {
        if (!message.id) continue;

        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          const headers = fullMessage.data.payload?.headers || [];
          const from = headers.find(h => h.name === 'From')?.value || '';
          const to = headers.find(h => h.name === 'To')?.value || '';
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const date = headers.find(h => h.name === 'Date')?.value || '';
          const snippet = fullMessage.data.snippet || '';

          // Get email body
          let body = '';
          if (fullMessage.data.payload?.body?.data) {
            body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
          } else if (fullMessage.data.payload?.parts) {
            // Multi-part email, find text/plain part
            const textPart = fullMessage.data.payload.parts.find(
              part => part.mimeType === 'text/plain'
            );
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
          }

          // Determine direction (sent or received)
          const direction = to.toLowerCase().includes(recipient.toLowerCase()) ? 'sent' : 'received';

          conversations.push({
            from,
            to,
            subject,
            body: body || snippet,
            snippet,
            timestamp: date,
            direction,
          });
        } catch (error) {
          console.error(`Failed to fetch message ${message.id}:`, error);
          continue;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch conversation with ${recipient}:`, error);
      continue;
    }
  }

  // Sort by timestamp (newest first)
  conversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return conversations;
}
