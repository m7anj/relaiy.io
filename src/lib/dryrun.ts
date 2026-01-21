/**
 * Simulate sending an email without actually sending it
 * Used for testing worker configurations before activation
 * @param base64EncodedEmail - The encoded email that would be sent
 * @returns Mock response simulating successful send
 */
export function simulateSendEmail(base64EncodedEmail: string): string {
  console.log('Dry run: Email would be sent with payload:', { base64EncodedEmail });
  return base64EncodedEmail;
}
