"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function Page() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <div className="text-[#6b6b6b]">Loading...</div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-screen bg-[#fafaf9] py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-16">
            <div>
              <h1 className="text-2xl font-medium text-[#2c2c2c] mb-2">relaiy.io</h1>
              <p className="text-[#6b6b6b] text-base">
                Email automation, described in plain English
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="text-sm text-[#6b6b6b] hover:text-[#2c2c2c] transition-colors"
            >
              Sign out
            </button>
          </div>

          <div className="space-y-4 mb-12">
            <Link
              href="/workers"
              className="group block border border-[#e5e5e5] p-8 hover:bg-[#f5f5f5] transition-colors"
            >
              <h2 className="text-lg font-medium text-[#2c2c2c] mb-2">
                Workers
              </h2>
              <p className="text-[#6b6b6b] text-sm mb-4">
                View and manage your email automation workers
              </p>
              <div className="text-[#6b6b6b] group-hover:text-[#2c2c2c] text-sm transition-colors">
                Open workers →
              </div>
            </Link>

            <Link
              href="/workers/new"
              className="group block border border-[#e5e5e5] p-8 hover:bg-[#f5f5f5] transition-colors"
            >
              <h2 className="text-lg font-medium text-[#2c2c2c] mb-2">
                Create worker
              </h2>
              <p className="text-[#6b6b6b] text-sm mb-4">
                Describe your automation in plain English
              </p>
              <div className="text-[#6b6b6b] group-hover:text-[#2c2c2c] text-sm transition-colors">
                Get started →
              </div>
            </Link>
          </div>

          <div className="pt-8 border-t border-[#e5e5e5]">
            <div className="text-xs text-[#a3a3a3] mb-1">Signed in as</div>
            <div className="text-sm text-[#2c2c2c]">
              {session.user?.email}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafaf9] px-6">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-medium text-[#2c2c2c] mb-3">relaiy.io</h1>
        <p className="text-base text-[#6b6b6b] mb-8">
          Email automation that speaks your language
        </p>
        <button
          onClick={() => signIn("google")}
          className="inline-flex items-center gap-3 px-6 py-3 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
