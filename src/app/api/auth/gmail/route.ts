// app/api/auth/login/route.ts
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const params = new URLSearchParams({
    client_id: process.env.OAUTH_CLIENT_ID!,
    redirect_uri: process.env.OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email profile",
    state: crypto.randomUUID(), // CSRF protection
  });

  return NextResponse.redirect(
    `${process.env.OAUTH_AUTH_URL}?${params.toString()}`,
  );
}
