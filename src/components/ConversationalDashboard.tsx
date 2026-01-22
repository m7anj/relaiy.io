"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Header from "./Header";

interface Worker {
  id: string;
  name: string;
  description: string;
  type: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "STOPPED";
  executionCount: number;
  lastExecutedAt: string | null;
  configuration: {
    interval: string;
    recipients: string[];
  };
}

interface ConversationalDashboardProps {
  initialWorkers?: Worker[];
}

export default function ConversationalDashboard({ initialWorkers = [] }: ConversationalDashboardProps) {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [suggestion, setSuggestion] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  const fetchWorkers = async () => {
    try {
      const res = await fetch("/api/workers");
      const data = await res.json();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error("Failed to fetch workers:", error);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    // Simple intent detection for suggestions
    if (value.toLowerCase().includes("create") || value.toLowerCase().includes("new")) {
      setSuggestion("Press Enter to create a new worker");
    } else if (value.toLowerCase().includes("show") || value.toLowerCase().includes("list")) {
      setSuggestion("Your workers are shown on the left");
    } else {
      setSuggestion("");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);

    try {
      // Route based on natural language intent
      const lowerInput = input.toLowerCase();

      if (lowerInput.includes("create") || lowerInput.includes("new worker")) {
        // Navigate to worker creation with pre-filled description
        router.push(`/workers/new?description=${encodeURIComponent(input)}`);
      } else if (lowerInput.includes("show") || lowerInput.includes("list")) {
        // Already showing workers, just clear input
        setInput("");
        setSuggestion("Your workers are displayed on the left");
      } else {
        // Default: treat as worker creation intent
        router.push(`/workers/new?description=${encodeURIComponent(input)}`);
      }
    } catch (error) {
      console.error("Failed to process input:", error);
    } finally {
      setTimeout(() => setIsProcessing(false), 500);
    }
  };

  const handleWorkerClick = (worker: Worker) => {
    setSelectedWorker(worker);
    router.push(`/workers/${worker.id}`);
  };

  const getStatusColor = (status: Worker["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "var(--color-status-active)";
      case "DRAFT":
        return "var(--color-status-draft)";
      case "PAUSED":
        return "var(--color-status-paused)";
      case "STOPPED":
        return "var(--color-status-stopped)";
      default:
        return "var(--color-text-tertiary)";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "OUTREACH": return "Outreach";
      case "NURTURE": return "Nurture";
      case "RESPONDER": return "Responder";
      case "DIGEST": return "Digest";
      default: return type;
    }
  };

  return (
    <>
      <Header />
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>
        {/* Left Panel - Workers List */}
        <aside
        className="w-80 border-r flex flex-col animate-slide-in-left"
        style={{
          borderColor: 'var(--color-border-default)',
          background: 'var(--color-bg-elevated)'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
          <h2
            className="text-lg font-medium mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)'
            }}
          >
            Your Workers
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {workers.length} {workers.length === 1 ? 'automation' : 'automations'}
          </p>
        </div>

        {/* Workers List */}
        <div className="flex-1 overflow-y-auto">
          {workers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No workers yet. Describe what you'd like to automate in the box to the right.
              </p>
            </div>
          ) : (
            <div className="py-2">
              {workers.map((worker, idx) => (
                <button
                  key={worker.id}
                  onClick={() => handleWorkerClick(worker)}
                  className={`w-full text-left px-6 py-4 transition-all duration-200 border-l-2 hover:bg-opacity-50 animate-fade-in stagger-${Math.min(idx + 1, 5)}`}
                  style={{
                    borderLeftColor: selectedWorker?.id === worker.id
                      ? 'var(--color-accent-primary)'
                      : 'transparent',
                    background: selectedWorker?.id === worker.id
                      ? 'var(--color-bg-hover)'
                      : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (selectedWorker?.id !== worker.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3
                      className="text-sm font-medium pr-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {worker.name}
                    </h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: `${getStatusColor(worker.status)}15`,
                        color: getStatusColor(worker.status)
                      }}
                    >
                      {worker.status.toLowerCase()}
                    </span>
                  </div>
                  <p
                    className="text-xs mb-2 line-clamp-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {worker.description}
                  </p>
                  <div
                    className="flex items-center gap-2 text-xs"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <span>{getTypeLabel(worker.type)}</span>
                    <span>•</span>
                    <span>{worker.executionCount} runs</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content - Conversational Interface */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="text-center mb-12 animate-slide-in-up">
            <h1
              className="text-5xl mb-4"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
                fontWeight: 400,
                letterSpacing: '-0.02em'
              }}
            >
              What would you like to automate?
            </h1>
            <p
              className="text-lg"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Describe your email workflow in plain English, and I'll handle the rest
            </p>
          </div>

          {/* Main Input */}
          <form onSubmit={handleSubmit} className="mb-6 animate-slide-in-up stagger-2">
            <div
              className="relative rounded-lg overflow-hidden transition-all duration-300"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '2px solid var(--color-border-default)',
                boxShadow: input ? 'var(--shadow-lg)' : 'var(--shadow-md)'
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="e.g., Send a warm check-in to my clients every Monday at 9am..."
                rows={4}
                disabled={isProcessing}
                className="w-full p-6 resize-none text-lg outline-none"
                style={{
                  background: 'transparent',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)'
                }}
              />

              {/* Input Footer */}
              <div
                className="flex items-center justify-between px-6 py-4 border-t"
                style={{
                  borderColor: 'var(--color-border-subtle)',
                  background: 'var(--color-bg-base)'
                }}
              >
                <div className="flex items-center gap-4">
                  {suggestion && (
                    <span
                      className="text-sm animate-fade-in"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {suggestion}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || isProcessing}
                  className="px-6 py-2 rounded-full transition-all duration-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: !input.trim() || isProcessing
                      ? 'var(--color-text-tertiary)'
                      : 'var(--color-accent-primary)',
                    color: 'white'
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Create →'}
                </button>
              </div>
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-3 animate-slide-in-up stagger-3">
            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              Try:
            </span>
            {[
              "Send weekly newsletter to subscribers",
              "Auto-reply to support emails",
              "Daily digest of unread emails"
            ].map((example, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInput(example);
                  inputRef.current?.focus();
                }}
                className="text-xs px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105"
                style={{
                  background: 'var(--color-bg-muted)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-subtle)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent-subtle)';
                  e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-bg-muted)';
                  e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </main>
      </div>
    </>
  );
}
