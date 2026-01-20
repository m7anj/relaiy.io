import { getAuthenticatedUser } from "@/lib/auth";
import { fetchEmailsFromRecipients } from "@/lib/gmail";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workerId } = await params;

  // 1. Auth check at the top
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. Get access token from user's Google account
  const accessToken = user.accounts[0]?.access_token;
  if (!accessToken) {
    return Response.json({ message: "No Google account connected" }, { status: 400 });
  }

  // 3. Now call pure lib functions with the access token
  try {
    const emails = await fetchEmailsFromRecipients(accessToken, ["test@example.com"]);

    return Response.json({
      message: "Execution started",
      workerId,
      emailCount: emails.length,
    });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
