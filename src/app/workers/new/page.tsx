"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const WORKER_TYPES = [
  {
    value: "OUTREACH",
    label: "Outreach",
    icon: "📧",
    description: "Send cold emails with clear CTAs to prospects",
    example: "Send a weekly outreach email to tech@company.com introducing our product",
  },
  {
    value: "NURTURE",
    label: "Nurture",
    icon: "🤝",
    description: "Warm relationship check-ins and follow-ups",
    example: "Send a monthly check-in to my clients asking how they're doing",
  },
  {
    value: "RESPONDER",
    label: "Responder",
    icon: "↩️",
    description: "Auto-reply to incoming emails",
    example: "Reply to support emails letting them know I'll respond within 24 hours",
  },
  {
    value: "DIGEST",
    label: "Digest",
    icon: "📊",
    description: "Summarize emails into a digest",
    example: "Send me a daily digest of all customer feedback emails",
  },
];

export default function NewWorkerPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    worker: {
      id: string;
      name: string;
      configuration: {
        interval: string;
        recipients: string[];
        tone?: string;
        style?: string;
      };
    };
    preview: {
      emails: Array<{
        recipient: string;
        subject: string;
        body: string;
      }>;
      note: string;
    };
  } | null>(null);

  const handleCreate = async () => {
    if (!selectedType || !description) return;

    setLoading(true);
    try {
      const res = await fetch("/api/workers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          description,
          name: name || description.slice(0, 50),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPreview(data);
      } else {
        alert(`Error: ${data.error || data.message}`);
      }
    } catch (error) {
      console.error("Failed to create worker:", error);
      alert("Failed to create worker");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = () => {
    if (preview?.worker.id) {
      router.push(`/workers/${preview.worker.id}`);
    }
  };

  if (preview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-2xl">
                ✓
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Worker Created!
                </h2>
                <p className="text-slate-600">Review the preview below</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Name</span>
                  <p className="font-medium text-slate-900">
                    {preview.worker.name}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Schedule</span>
                  <p className="font-medium text-slate-900">
                    {preview.worker.configuration.interval}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Recipients</span>
                  <p className="font-medium text-slate-900">
                    {preview.worker.configuration.recipients.join(", ")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Style</span>
                  <p className="font-medium text-slate-900">
                    {preview.worker.configuration.tone} •{" "}
                    {preview.worker.configuration.style}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                Email Preview
              </h3>
              <p className="text-sm text-amber-600 mb-4">
                {preview.preview.note}
              </p>
              <div className="space-y-4">
                {preview.preview.emails.map((email, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-lg p-4 bg-white"
                  >
                    <div className="text-xs text-slate-500 mb-2">
                      To: {email.recipient}
                    </div>
                    <div className="font-semibold text-slate-900 mb-3">
                      {email.subject}
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-line">
                      {email.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleActivate}
                className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium"
              >
                Go to Worker →
              </button>
              <Link
                href="/workers"
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center"
              >
                View All Workers
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/workers"
          className="inline-block text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          ← Back to Workers
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Create a Worker
          </h1>
          <p className="text-slate-600 mb-8">
            Describe what you want in plain English, we'll handle the rest
          </p>

          {/* Worker Type Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Worker Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {WORKER_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    setSelectedType(type.value);
                    if (!description) {
                      setDescription(type.example);
                    }
                  }}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    selectedType === type.value
                      ? "border-slate-900 bg-slate-50 shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <div className="font-semibold text-slate-900 mb-1">
                    {type.label}
                  </div>
                  <div className="text-xs text-slate-600">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Worker Name <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Client Check-in"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>

          {/* Description Input */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              What should this worker do?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe in plain English what you want this worker to do. Include who to email, what to say, and how often to send."
              rows={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">
              Example: "Send a weekly check-in email to my clients every Monday
              at 9am asking how their project is going"
            </p>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreate}
            disabled={!selectedType || !description || loading}
            className={`w-full px-6 py-4 rounded-lg font-medium transition-all ${
              !selectedType || !description || loading
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/20"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating Worker...
              </span>
            ) : (
              "Create Worker & Preview"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
