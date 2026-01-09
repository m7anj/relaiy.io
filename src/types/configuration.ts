export interface Configuration {
  interval: string;                     // "daily at 9am", "every Monday", "every 3 days"

  recipients: string[];                 // email addresses to send to

  // LLM context - what emails to reference when generating
  contextEmails?: {
    labels?: string[];                  // fetch emails with these labels
    from?: string[];                    // fetch emails from these senders
    limit?: number;                     // how many to fetch (default: 5)
  };

  // LLM instructions
  tone?: string;                        // "professional", "casual", "friendly", "formal"
  style?: string;                       // "brief", "detailed", "creative"
  customInstructions?: string;          // additional free-form instructions

  // Email settings
  subjectTemplate?: string | null;     // subject line template (null = LLM decides)

  // When to stop
  lifespan?: number;               // stop after X sends (default: 1)
}