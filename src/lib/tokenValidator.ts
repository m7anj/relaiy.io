import { google } from 'googleapis';

/**
 * Test if a Google OAuth token is valid by making a simple API call
 */
export async function validateGoogleToken(accessToken: string): Promise<boolean> {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Try to get user info - lightweight API call
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    await oauth2.userinfo.get();

    return true;
  } catch (error) {
    console.error('[Token Validator] Token validation failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get detailed token info for debugging
 */
export async function getTokenInfo(accessToken: string): Promise<any> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
    return await response.json();
  } catch (error) {
    console.error('[Token Validator] Failed to get token info:', error);
    return null;
  }
}
