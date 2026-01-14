import { google } from "googleapis";

/**
 * Pure Gmail utility - no auth logic here
 * Takes accessToken directly, throws errors instead of returning Response objects
 */

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
 */
export async function fetchEmailsFromRecipients(accessToken: string, recipients: string[]) {
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

    // Build query: from:email1 OR from:email2 OR ...
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
