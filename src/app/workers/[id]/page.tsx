"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Worker {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  executionCount: number;
  lastExecutedAt: string | null;
  lastExecutionStatus: string | null;
  configuration: {
    interval: string;
    recipients: string[];
    tone?: string;
    style?: string;
    subjectTemplate?: string;
    lifespan?: number;
  };
  createdAt: string;
}

interface Execution {
  id: string;
  status: string;
  executedAt: string;
  emailCount: number;
  duration: number | null;
  error: string | null;
  isDryRun: boolean;
  affectedEmails: string[];
}

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workerId = params.id as string;

  const [worker, setWorker] = useState<Worker | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchWorker();
    fetchExecutions();
  }, [workerId]);

  const fetchWorker = async () => {
    try {
      const res = await fetch(`/api/workers/${workerId}`);
      const data = await res.json();
      setWorker(data.worker);
    } catch (error) {
      console.error("Failed to fetch worker:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const res = await fetch(`/api/workers/${workerId}/logs?limit=10`);
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (error) {
      console.error("Failed to fetch executions:", error);
    }
  };

  const handleExecute = async (isDryRun: boolean = false) => {
    setExecuting(true);
    try {
      const res = await fetch(`/api/workers/${workerId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDryRun }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(
          isDryRun
            ? "Dry run completed! Check execution logs."
            : data.isFirstExecution
            ? `Worker activated! Now scheduled to run ${worker?.configuration.interval}`
            : "Execution completed!"
        );
        fetchWorker();
        fetchExecutions();
      } else {
        alert(`Error: ${data.error || data.message}`);
      }
    } catch (error) {
      console.error("Execution failed:", error);
      alert("Execution failed");
    } finally {
      setExecuting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchWorker();
      } else {
        alert("Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/workers");
      } else {
        alert("Failed to delete worker");
      }
    } catch (error) {
      console.error("Failed to delete worker:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <div className="text-[#6b6b6b]">Loading...</div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <div className="text-[#6b6b6b]">Worker not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/workers"
          className="inline-block text-[#6b6b6b] hover:text-[#2c2c2c] mb-12 transition-colors text-sm"
        >
          ← Workers
        </Link>

        {/* Header */}
        <div className="mb-12">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-medium text-[#2c2c2c]">
                {worker.name}
              </h1>
              <span className="text-xs text-[#6b6b6b] px-2 py-0.5 border border-[#e5e5e5]">
                {worker.status}
              </span>
            </div>
            <p className="text-[#6b6b6b] text-base">{worker.description}</p>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-6 py-6 border-t border-b border-[#e5e5e5] mb-8">
            <div>
              <div className="text-[#6b6b6b] text-sm mb-1">Type</div>
              <div className="text-[#2c2c2c]">{worker.type}</div>
            </div>
            <div>
              <div className="text-[#6b6b6b] text-sm mb-1">Schedule</div>
              <div className="text-[#2c2c2c]">
                {worker.configuration.interval}
              </div>
            </div>
            <div>
              <div className="text-[#6b6b6b] text-sm mb-1">Recipients</div>
              <div className="text-[#2c2c2c] text-sm">
                {worker.configuration.recipients.join(", ")}
              </div>
            </div>
            <div>
              <div className="text-[#6b6b6b] text-sm mb-1">Style</div>
              <div className="text-[#2c2c2c]">
                {worker.configuration.style}
              </div>
            </div>
            <div>
              <div className="text-[#6b6b6b] text-sm mb-1">Executions</div>
              <div className="text-[#2c2c2c]">{worker.executionCount}</div>
            </div>
            {worker.lastExecutedAt && (
              <div>
                <div className="text-[#6b6b6b] text-sm mb-1">Last run</div>
                <div className="text-[#2c2c2c]">
                  {new Date(worker.lastExecutedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {worker.status === "DRAFT" && (
              <button
                onClick={() => handleExecute(false)}
                disabled={executing}
                className="px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors disabled:opacity-50 text-sm"
              >
                {executing ? "Activating..." : "Activate & send first email"}
              </button>
            )}

            {worker.status === "ACTIVE" && (
              <>
                <button
                  onClick={() => handleExecute(false)}
                  disabled={executing}
                  className="px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors disabled:opacity-50 text-sm"
                >
                  {executing ? "Executing..." : "Execute now"}
                </button>
                <button
                  onClick={() => handleUpdateStatus("PAUSED")}
                  className="px-5 py-2.5 text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm"
                >
                  Pause
                </button>
              </>
            )}

            {worker.status === "PAUSED" && (
              <button
                onClick={() => handleUpdateStatus("ACTIVE")}
                className="px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors text-sm"
              >
                Resume
              </button>
            )}

            <Link
              href={`/workers/${workerId}/edit`}
              className="px-5 py-2.5 text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm"
            >
              Edit
            </Link>

            <button
              onClick={() => handleExecute(true)}
              disabled={executing}
              className="px-5 py-2.5 text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50 text-sm"
            >
              {executing ? "Running..." : "Test run"}
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 text-[#6b6b6b] hover:text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm ml-auto"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Execution Logs */}
        <div className="mb-12">
          <h2 className="text-lg font-medium text-[#2c2c2c] mb-6">
            Execution history
          </h2>

          {executions.length === 0 ? (
            <div className="text-center py-12 text-[#6b6b6b] border border-[#e5e5e5] bg-white">
              <p className="text-sm">No executions yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {executions.map((execution) => (
                <div
                  key={execution.id}
                  className="border-b border-[#e5e5e5] py-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-[#2c2c2c]">
                          {execution.status}
                        </span>
                        {execution.isDryRun && (
                          <span className="px-2 py-0.5 text-xs text-[#6b6b6b] border border-[#e5e5e5]">
                            Dry run
                          </span>
                        )}
                        <span className="text-xs text-[#a3a3a3]">
                          {new Date(execution.executedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-[#6b6b6b]">
                        {execution.emailCount} emails
                        {execution.duration && ` • ${execution.duration}ms`}
                      </div>
                      {execution.error && (
                        <div className="mt-2 text-sm text-[#6b6b6b] border-l-2 border-[#e5e5e5] pl-3">
                          {execution.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white p-8 max-w-md w-full border border-[#e5e5e5] shadow-2xl">
              <h3 className="text-lg font-medium text-[#2c2c2c] mb-3">
                Delete worker
              </h3>
              <p className="text-[#6b6b6b] text-sm mb-6 leading-relaxed">
                This will permanently delete "{worker.name}" and all execution
                logs. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-5 py-2.5 border border-[#e5e5e5] text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
