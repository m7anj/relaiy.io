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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "OUTREACH":
        return "Outreach";
      case "NURTURE":
        return "Nurture";
      case "RESPONDER":
        return "Responder";
      case "DIGEST":
        return "Digest";
      default:
        return type;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <div className="text-[#6b6b6b]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] py-16 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-block text-[#6b6b6b] hover:text-[#2c2c2c] mb-12 transition-colors text-sm"
          >
            ← Home
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-medium text-[#2c2c2c] mb-2">
                Workers
              </h1>
              <p className="text-[#6b6b6b] text-base">
                Email automation agents that run on schedule
              </p>
            </div>
            <Link
              href="/workers/new"
              className="px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors text-sm"
            >
              Create worker
            </Link>
          </div>
        </div>

        {/* Workers Grid */}
        {workers.length === 0 ? (
          <div className="text-center py-20 border border-[#e5e5e5] bg-white">
            <h3 className="text-lg font-medium text-[#2c2c2c] mb-2">
              No workers yet
            </h3>
            <p className="text-[#6b6b6b] mb-6 text-sm">
              Create your first automation worker to get started
            </p>
            <Link
              href="/workers/new"
              className="inline-block px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors text-sm"
            >
              Create worker
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {workers.map((worker) => (
              <Link
                key={worker.id}
                href={`/workers/${worker.id}`}
                className="group block"
              >
                <div className="border-b border-[#e5e5e5] py-6 hover:bg-[#f5f5f5] transition-colors px-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-medium text-[#2c2c2c]">
                          {worker.name}
                        </h3>
                        <span className="text-xs text-[#6b6b6b] px-2 py-0.5 border border-[#e5e5e5]">
                          {worker.status}
                        </span>
                      </div>
                      <p className="text-[#6b6b6b] text-sm mb-3">
                        {worker.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[#a3a3a3]">
                        <span>
                          {getTypeLabel(worker.type)}
                        </span>
                        <span>•</span>
                        <span>{worker.executionCount} executions</span>
                        {worker.lastExecutedAt && (
                          <>
                            <span>•</span>
                            <span>
                              {new Date(worker.lastExecutedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-[#a3a3a3] group-hover:text-[#2c2c2c] transition-colors">
                      →
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
