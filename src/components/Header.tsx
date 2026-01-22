"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);

  if (!session) return null;

  return (
    <header
      className="absolute top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
    >
      <Link
        href="/dashboard"
        className="text-lg font-medium transition-colors hover:opacity-70"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)'
        }}
      >
        relaiy
      </Link>

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-200"
          style={{
            background: showMenu ? 'var(--color-bg-hover)' : 'transparent',
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            if (!showMenu) {
              e.currentTarget.style.background = 'var(--color-bg-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (!showMenu) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span className="text-sm">{session.user?.email}</span>
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{ transform: showMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <div
            className="absolute right-0 mt-2 w-56 rounded-lg overflow-hidden animate-scale-in"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <Link
              href="/workers"
              onClick={() => setShowMenu(false)}
              className="block px-4 py-3 text-sm transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              All workers
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setShowMenu(false)}
              className="block px-4 py-3 text-sm transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Dashboard
            </Link>
            <div
              className="border-t"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            />
            <button
              onClick={() => {
                setShowMenu(false);
                signOut();
              }}
              className="w-full text-left px-4 py-3 text-sm transition-colors"
              style={{ color: 'var(--color-accent-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
