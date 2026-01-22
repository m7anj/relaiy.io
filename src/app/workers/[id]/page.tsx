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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Worker not found</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500";
      case "DRAFT":
        return "bg-amber-500";
      case "PAUSED":
        return "bg-blue-500";
      case "STOPPED":
        return "bg-slate-500";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link
          href="/workers"
          className="inline-block text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          ← Back to Workers
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-slate-900">
                  {worker.name}
                </h1>
                <div
                  className={`w-3 h-3 rounded-full ${getStatusColor(
                    worker.status
                  )}`}
                />
                <span className="text-sm font-medium text-slate-600">
                  {worker.status}
                </span>
              </div>
              <p className="text-slate-600 mb-4">{worker.description}</p>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="font-medium">Type: {worker.type}</span>
                <span>•</span>
                <span>{worker.executionCount} executions</span>
                {worker.lastExecutedAt && (
                  <>
                    <span>•</span>
                    <span>
                      Last run:{" "}
                      {new Date(worker.lastExecutedAt).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl mb-6">
            <div>
              <div className="text-xs text-slate-500 mb-1">Schedule</div>
              <div className="font-medium text-slate-900">
                {worker.configuration.interval}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Recipients</div>
              <div className="font-medium text-slate-900">
                {worker.configuration.recipients.join(", ")}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Style</div>
              <div className="font-medium text-slate-900">
                {worker.configuration.tone} • {worker.configuration.style}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {worker.status === "DRAFT" && (
              <button
                onClick={() => handleExecute(false)}
                disabled={executing}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50 font-medium shadow-lg shadow-emerald-600/20"
              >
                {executing ? "Activating..." : "Activate & Send First Email"}
              </button>
            )}

            {worker.status === "ACTIVE" && (
              <>
                <button
                  onClick={() => handleExecute(false)}
                  disabled={executing}
                  className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 font-medium"
                >
                  {executing ? "Executing..." : "Execute Now"}
                </button>
                <button
                  onClick={() => handleUpdateStatus("PAUSED")}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Pause Worker
                </button>
              </>
            )}

            {worker.status === "PAUSED" && (
              <button
                onClick={() => handleUpdateStatus("ACTIVE")}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
              >
                Resume Worker
              </button>
            )}

            <Link
              href={`/workers/${workerId}/edit`}
              className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium inline-flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit Configuration
            </Link>

            <button
              onClick={() => handleExecute(true)}
              disabled={executing}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium"
            >
              {executing ? "Running..." : "Test Run (Dry Run)"}
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium ml-auto"
            >
              Delete Worker
            </button>
          </div>
        </div>

        {/* Execution Logs */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Execution History
          </h2>

          {executions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No executions yet. Run the worker to see logs here.
            </div>
          ) : (
            <div className="space-y-3">
              {executions.map((execution) => (
                <div
                  key={execution.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            execution.status === "SUCCESS"
                              ? "bg-emerald-500"
                              : execution.status === "ERROR"
                              ? "bg-red-500"
                              : "bg-blue-500 animate-pulse"
                          }`}
                        />
                        <span className="font-medium text-slate-900">
                          {execution.status}
                        </span>
                        {execution.isDryRun && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                            DRY RUN
                          </span>
                        )}
                        <span className="text-sm text-slate-500">
                          {new Date(execution.executedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {execution.emailCount} emails •{" "}
                        {execution.duration
                          ? `${execution.duration}ms`
                          : "Duration unknown"}
                      </div>
                      {execution.error && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Delete Worker?
              </h3>
              <p className="text-slate-600 mb-6">
                This will permanently delete "{worker.name}" and all execution
                logs. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium"
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
