import { google } from "googleapis";

/**
 * Get Gmail client for making API calls
 */
export function getGmailClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    return google.gmail({ version: "v1", auth: oauth2Client });
}




/**
 * Fetch emails from Gmail API using list of recipients & access token
 * @param accessToken
 * @param recipients
 * @returns
 */
export async function fetchEmailsFromRecipients(
    accessToken: string,
    recipients: string[]
) {
    // Making sure whether the recipient is a single email or a list of emails or nothing at all
    if (recipients.length === 0) {
        throw new Error("No recipients provided");
    }

    // fetch specific emails from gmail API
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
        access_token: accessToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const query = 
        recipients.map((recipient) => `from:${recipient}`)  // maps a .from:{} to every single email
        .join(" OR ");  // joins them with OR to satsify the query

    const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 10,
    });
    return response.data.messages || [];
}




/**
 * Send an email using Gmail API
 * @param accessToken - User's OAuth access token
 * @param recipient - Email address to send to
 * @param subject - Email subject line
 * @param body - Email body content (plain text)
 */
export async function sendEmail(
    accessToken: string,
    recipient: string[],
    subject: string,
    body: string,
    dryRun: boolean = false,
) {
    const gmail = getGmailClient(accessToken);

    // STEP 1: Build RFC 2822 formatted email
    // RFC 2822 is the standard email format: headers followed by body
    // Each header is "Key: Value\r\n", then blank line, then body
    const query = 
        recipient.map((recipient) => `from:${recipient}`)  // maps a .from:{} to every single email
        .join(" OR ");  // joins them with OR to satsify the query
    
    const emailLines = [
        `To: ${query}`,
        `Subject: ${subject}`,
        '', // blank line separates headers from body
        body
    ];
    const email = emailLines.join('\r\n');

    // STEP 2: Encode to base64url
    // Gmail API requires base64url (not regular base64)
    // base64url replaces + with -, / with _, and removes = padding
    const base64EncodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    
    if (dryRun) {
        console.log('Dry run: ', { base64EncodedEmail });
        return "base64EncodedEmail";
    } else {
        const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
            raw: base64EncodedEmail
        }
    });

    return response.data;
    }
}
