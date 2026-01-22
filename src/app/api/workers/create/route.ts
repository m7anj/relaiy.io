import type { WorkerType } from '@/types/worker';
import { generateWorkerConfig } from '@/lib/creation';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmailPreviews } from '@/lib/preview';
import { fetchEmailsFromRecipients, getGmailClient } from '@/lib/gmail';

export async function POST(req: Request) {
  // 1. Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. Get access token
  const accessToken = user.accounts[0]?.access_token;
  if (!accessToken) {
    return Response.json({ message: "No Google account connected" }, { status: 400 });
  }

  try {
    // 3. Parse request body
    const { description, type, name, context, recipients } = await req.json();

    if (!description || !type) {
      return Response.json(
        { message: "Description and type are required" },
        { status: 400 }
      );
    }

    if (recipients && (!Array.isArray(recipients) || recipients.length === 0)) {
      return Response.json(
        { message: "Recipients must be a non-empty array" },
        { status: 400 }
      );
    }

    // 4. Generate configuration from natural language
    const configuration = await generateWorkerConfig(description, type as WorkerType, context);

    // Override recipients if provided by user
    if (recipients && recipients.length > 0) {
      configuration.recipients = recipients;
    }

    // 5. Fetch context emails if configured
    const contextEmails: Array<{ snippet?: string; subject?: string }> = [];
    if (configuration.contextEmails?.from && configuration.contextEmails.from.length > 0) {
      try {
        const gmail = getGmailClient(accessToken);
        const messages = await fetchEmailsFromRecipients(
          accessToken,
          configuration.contextEmails.from
        );

        // Fetch full email details for context
        for (const message of messages.slice(0, 3)) {
          if (message.id) {
            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'metadata',
              metadataHeaders: ['Subject'],
            });

            contextEmails.push({
              subject: fullMessage.data.payload?.headers?.find(h => h.name === 'Subject')?.value || '',
              snippet: message.snippet || '',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch context emails:', error);
        // Continue without context emails
      }
    }

    // 6. Generate preview emails (DRY RUN)
    const workerName = name || description.slice(0, 50);
    const previews = await generateEmailPreviews(
      configuration,
      type as WorkerType,
      workerName,
      contextEmails
    );

    // 7. Save worker to database as DRAFT
    const worker = await prisma.worker.create({
      data: {
        userId: user.id,
        name: workerName,
        description,
        type: type as WorkerType,
        status: 'DRAFT',
        configuration: configuration,
        information: context || [],
      },
    });

    // 8. Return configuration and preview
    return Response.json({
      message: "Worker created successfully with preview",
      worker: {
        id: worker.id,
        name: worker.name,
        description: worker.description,
        type: worker.type,
        status: worker.status,
        configuration,
      },
      preview: {
        emails: previews,
        note: "These are preview emails. No emails have been sent. Activate the worker to start sending.",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json(
      { message: "Failed to create worker", error: errorMessage },
      { status: 500 }
    );
  }
}
