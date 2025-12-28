import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch(process.env.OAUTH_TOKEN_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.OAUTH_REDIRECT_URI!,
      client_id: process.env.OAUTH_CLIENT_ID!,
      client_secret: process.env.OAUTH_CLIENT_SECRET!,
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json(tokens, { status: 400 });
  }

  // Optional: fetch user profile
  const userRes = await fetch(process.env.OAUTH_USERINFO_URL!, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  const user = await userRes.json();

  /**
   * At this point you usually:
   * - Create DB user
   * - Create session / JWT
   * - Set HttpOnly cookie
   */

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set("session", "your-session-token", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });

  return response;
}
