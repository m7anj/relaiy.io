"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Worker {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  executionCount: number;
  lastExecutedAt: string | null;
  lastExecutionStatus: string | null;
  createdAt: string;
}

export default function WorkersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchWorkers();
    }
  }, [status]);

  const fetchWorkers = async () => {
    try {
      const res = await fetch("/api/workers");
      const data = await res.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error("Failed to fetch workers:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "DRAFT":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "PAUSED":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "STOPPED":
        return "bg-slate-500/10 text-slate-600 border-slate-500/20";
      default:
        return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "OUTREACH":
        return "📧 Outreach";
      case "NURTURE":
        return "🤝 Nurture";
      case "RESPONDER":
        return "↩️ Responder";
      case "DIGEST":
        return "📊 Digest";
      default:
        return type;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-block text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Workers
              </h1>
              <p className="text-slate-600">
                Email automation agents that run on schedule
              </p>
            </div>
            <Link
              href="/workers/new"
              className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 font-medium shadow-lg shadow-slate-900/20"
            >
              Create Worker
            </Link>
          </div>
        </div>

        {/* Workers Grid */}
        {workers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              No workers yet
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first automation worker to get started
            </p>
            <Link
              href="/workers/new"
              className="inline-block px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
            >
              Create Your First Worker
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {workers.map((worker) => (
              <Link
                key={worker.id}
                href={`/workers/${worker.id}`}
                className="group block"
              >
                <div className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                          {worker.name}
                        </h3>
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                            worker.status
                          )}`}
                        >
                          {worker.status}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm mb-3">
                        {worker.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="font-medium">
                          {getTypeLabel(worker.type)}
                        </span>
                        <span>•</span>
                        <span>{worker.executionCount} executions</span>
                        {worker.lastExecutedAt && (
                          <>
                            <span>•</span>
                            <span>
                              Last run:{" "}
                              {new Date(worker.lastExecutedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {worker.lastExecutionStatus === "SUCCESS" && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      )}
                      {worker.lastExecutionStatus === "ERROR" && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                      {worker.lastExecutionStatus === "RUNNING" && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      )}
                      <svg
                        className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
