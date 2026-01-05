# Gmail API Integration Guide

## Overview

You've already authenticated users with Google OAuth. Now you'll extend that to access their Gmail data. This involves:

1. Adding Gmail scopes to your OAuth request
2. Storing the access token
3. Using the Gmail API to read/send emails

---

## Step 1: Add Gmail API Scopes

### What are OAuth Scopes?

Scopes define what permissions your app requests from the user. Currently, you're only getting basic profile info (name, email). To access Gmail, you need to request additional scopes.

### Common Gmail Scopes

```
gmail.readonly              - Read all emails (safest)
gmail.modify                - Read and modify (archive, label, mark read)
gmail.send                  - Send emails on behalf of user
gmail.compose              - Create drafts
```

**For Relaiy, you'll need:**
- `https://www.googleapis.com/auth/gmail.modify` - Read, label, archive emails
- `https://www.googleapis.com/auth/gmail.send` - Send automated replies

### Update Your NextAuth Config

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
          ].join(" "),
          // Important: request offline access to get refresh token
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**What this does:**
- `scope` - Lists all permissions you're requesting
- `access_type: "offline"` - Gets a refresh token (stays valid after user closes browser)
- `prompt: "consent"` - Forces the consent screen to show (ensures you get refresh token)

---

## Step 2: Store Access & Refresh Tokens

When the user signs in, Google returns tokens. You need to save these to make API calls later.

### Option A: Store in Session (Simple, but tokens expire)

```typescript
// src/app/api/auth/[...nextauth]/route.ts
export const authOptions = {
  providers: [
    GoogleProvider({
      // ... (config from above)
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On initial sign-in, account object contains the tokens
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at;
      }

      // If token hasn't expired, return it
      if (Date.now() < (token.accessTokenExpires as number) * 1000) {
        return token;
      }

      // Token expired, refresh it
      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Make tokens available in session
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
};

async function refreshAccessToken(token: any) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}
```

**What this does:**
- `jwt` callback runs on every request to check/refresh tokens
- `session` callback adds the access token to the session object
- `refreshAccessToken` gets a new access token when the old one expires

### Option B: Store in Database (Recommended for production)

With Prisma adapter, tokens are automatically saved to the database.

```typescript
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      // ... (config from Step 1)
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Get the access token from database
      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: "google" },
      });
      
      session.accessToken = account?.access_token;
      return session;
    },
  },
};
```

---

## Step 3: Update Google Cloud Console

Before testing, you need to:

1. **Enable Gmail API:**
   - Go to https://console.cloud.google.com/apis/library
   - Search "Gmail API"
   - Click "Enable"

2. **Update OAuth consent screen:**
   - Go to https://console.cloud.google.com/apis/credentials/consent
   - Under "Scopes", add:
     - `.../auth/gmail.modify`
     - `.../auth/gmail.send`
   - Save changes

3. **No changes needed to OAuth Client ID** - Same redirect URI works

---

## Step 4: Test Getting an Access Token

Create a test page to verify you're getting tokens:

```typescript
// src/app/test-gmail/page.tsx
"use client";

import { useSession } from "next-auth/react";

export default function TestGmailPage() {
  const { data: session } = useSession();

  return (
    <div>
      <h1>Gmail Token Test</h1>
      {session?.accessToken ? (
        <div>
          <p style={{ color: "green" }}>✓ Access token received!</p>
          <code style={{ fontSize: "10px", wordBreak: "break-all" }}>
            {session.accessToken}
          </code>
        </div>
      ) : (
        <p style={{ color: "red" }}>✗ No access token found</p>
      )}
      {session?.error && (
        <p style={{ color: "red" }}>Error: {session.error}</p>
      )}
    </div>
  );
}
```

**To test:**
1. Sign out completely: `http://localhost:3000/api/auth/signout`
2. Sign in again - you'll see the new consent screen with Gmail permissions
3. Visit `http://localhost:3000/test-gmail`
4. You should see your access token

---

## Step 5: Use the Gmail API

Now you can make Gmail API calls using the access token.

### Example: Fetch Inbox Messages

```typescript
// src/app/api/gmail/messages/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // List messages in inbox
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10",
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Fetch full details for each message
    const messages = await Promise.all(
      data.messages.map(async (msg: any) => {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );
        return msgResponse.json();
      })
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Gmail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
```

### Display Messages in UI

```typescript
// src/app/inbox/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function InboxPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gmail/messages")
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading inbox...</div>;

  return (
    <div>
      <h1>Your Inbox</h1>
      {messages.map((msg) => {
        const subject = msg.payload.headers.find(
          (h: any) => h.name === "Subject"
        )?.value;
        const from = msg.payload.headers.find(
          (h: any) => h.name === "From"
        )?.value;

        return (
          <div key={msg.id} style={{ border: "1px solid #ccc", padding: 10, margin: 10 }}>
            <strong>{subject}</strong>
            <p>From: {from}</p>
            <small>ID: {msg.id}</small>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Step 6: Use the Gmail Node.js Client (Easier)

Instead of raw fetch calls, use Google's official library (you already have `googleapis` installed!):

```typescript
// src/lib/gmail.ts
import { google } from "googleapis";

export function getGmailClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
```

### Updated API Route

```typescript
// src/app/api/gmail/messages/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { getGmailClient } from "@/lib/gmail";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const gmail = getGmailClient(session.accessToken);

    // List messages
    const response = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      q: "is:unread", // Optional: filter unread messages
    });

    // Fetch full message details
    const messages = await Promise.all(
      (response.data.messages || []).map(async (msg) => {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
        });
        return fullMsg.data;
      })
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Gmail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
```

---

## Common Gmail API Operations

### Send an Email

```typescript
import { getGmailClient } from "@/lib/gmail";

const gmail = getGmailClient(session.accessToken);

const message = [
  "To: recipient@example.com",
  "Subject: Test Email",
  "",
  "This is the email body",
].join("\n");

const encodedMessage = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

await gmail.users.messages.send({
  userId: "me",
  requestBody: {
    raw: encodedMessage,
  },
});
```

### Label a Message

```typescript
await gmail.users.messages.modify({
  userId: "me",
  id: messageId,
  requestBody: {
    addLabelIds: ["Label_123"],
    removeLabelIds: ["UNREAD"],
  },
});
```

### Search Messages

```typescript
const response = await gmail.users.messages.list({
  userId: "me",
  q: "from:recruiter@company.com is:unread", // Gmail search syntax
});
```

### Get All Labels

```typescript
const response = await gmail.users.labels.list({
  userId: "me",
});
console.log(response.data.labels);
```

---

## Type Safety (Optional)

Add TypeScript types for the session:

```typescript
// src/types/next-auth.d.ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
```

---

## Security Notes

1. **Never expose access tokens to the client**
   - Keep all Gmail API calls in API routes (server-side)
   - Don't pass tokens to client components

2. **Rate Limiting**
   - Gmail API has quotas (check console.cloud.google.com)
   - For Relaiy, you'll hit limits if many users run workers simultaneously
   - Implement request queuing or throttling

3. **Token Storage**
   - For production, use database storage with encryption
   - Refresh tokens are long-lived and sensitive

4. **Error Handling**
   - User might revoke access - handle 401 errors gracefully
   - Token refresh can fail - prompt re-authentication

---

## Testing Checklist

- [ ] Sign out and sign in again to trigger new consent screen
- [ ] Verify Gmail API is enabled in Google Cloud Console
- [ ] Check access token appears in session
- [ ] Test fetching messages from `/api/gmail/messages`
- [ ] Display messages in UI
- [ ] Test sending an email (be careful - it actually sends!)

---

## Next Steps After This

Once you can read emails, you're ready to build:

1. **Search/Filter System** - Let users describe filters in plain English
2. **LLM Config Generator** - Convert descriptions to Gmail queries
3. **Worker Preview** - Show which emails match a worker's rules
4. **Action Execution** - Actually send replies, add labels, etc.

---

## References

- [Gmail API Documentation](https://developers.google.com/gmail/api/guides)
- [Gmail API Node.js Client](https://googleapis.dev/nodejs/googleapis/latest/gmail/index.html)
- [Gmail Search Syntax](https://support.google.com/mail/answer/7190?hl=en)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes#gmail)

---

Good luck! Start with Step 1 (adding scopes) and test each step before moving to the next.
