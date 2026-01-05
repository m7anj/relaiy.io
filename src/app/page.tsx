"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function Page() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div>
        <nav style={{ marginBottom: "20px" }}>
          <Link href="/inbox" style={{ marginRight: "15px" }}>Inbox</Link>
          <Link href="/workers" style={{ marginRight: "15px" }}>Workers</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
        <p>Signed in as {session.user?.email}</p>
        <button onClick={() => signOut()}>Sign out</button>
      </div>
    );
  }

  return (
    <div>
      <p>Not signed in</p>
      <button onClick={() => signIn("google")}>Sign in with Google</button>
    </div>
  );
}
