"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const WORKER_TYPES = [
  {
    value: "OUTREACH",
    label: "Outreach",
    description: "Send cold emails with clear CTAs",
  },
  {
    value: "NURTURE",
    label: "Nurture",
    description: "Warm relationship check-ins",
  },
  {
    value: "RESPONDER",
    label: "Responder",
    description: "Auto-reply to incoming emails",
  },
  {
    value: "DIGEST",
    label: "Digest",
    description: "Summarize emails into a digest",
  },
];

const STYLE_OPTIONS = [
  { value: "super-human", label: "Super-human" },
  { value: "professional", label: "Professional" },
  { value: "concise", label: "Concise" },
];

export default function NewWorkerPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [senderName, setSenderName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string>("professional");
  const [loading, setLoading] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; size: number }>>([]);
  const [showIntervalWarning, setShowIntervalWarning] = useState(false);
  const [pendingWorkerData, setPendingWorkerData] = useState<any>(null);
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

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && recipientInput.trim()) {
      e.preventDefault();
      const email = recipientInput.trim();

      // Basic email validation
      if (email.includes("@") && !recipients.includes(email)) {
        setRecipients([...recipients, email]);
        setRecipientInput("");
      }
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const MAX_CHARS_PER_FILE = 10000; // 10k characters per file

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();

        if (text.length > MAX_CHARS_PER_FILE) {
          alert(`File "${file.name}" exceeds ${MAX_CHARS_PER_FILE} character limit`);
          continue;
        }

        setUploadedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            content: text,
            size: text.length,
          },
        ]);
      } catch (error) {
        console.error(`Failed to read file ${file.name}:`, error);
        alert(`Failed to read file: ${file.name}`);
      }
    }

    // Reset input
    e.target.value = "";
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleCreate = async (confirmShortInterval: boolean = false) => {
    if (!selectedType || !description) return;

    if (recipients.length === 0) {
      alert("Please add at least one recipient");
      return;
    }

    setLoading(true);
    try {
      // Combine file contents into context array
      const contextArray = uploadedFiles.map((file) => `File: ${file.name}\n${file.content}`);

      const workerData = {
        type: selectedType,
        description,
        name: name || description.slice(0, 50),
        recipients,
        senderName: senderName || undefined,
        style: selectedStyle,
        context: contextArray.length > 0 ? contextArray : undefined,
        confirmShortInterval,
      };

      const res = await fetch("/api/workers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workerData),
      });

      const data = await res.json();

      if (res.ok) {
        // Check if confirmation is required
        if (data.requiresConfirmation) {
          setPendingWorkerData(workerData);
          setShowIntervalWarning(true);
          setLoading(false);
          return;
        }

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

  const handleConfirmInterval = async () => {
    setShowIntervalWarning(false);
    if (pendingWorkerData) {
      await handleCreate(true);
      setPendingWorkerData(null);
    }
  };

  const handleCancelInterval = () => {
    setShowIntervalWarning(false);
    setPendingWorkerData(null);
  };

  const handleActivate = () => {
    if (preview?.worker.id) {
      router.push(`/workers/${preview.worker.id}`);
    }
  };

  const handleEditAndRegenerate = () => {
    // Go back to edit mode, keeping the form data
    setPreview(null);
  };

  if (preview) {
    return (
      <div className="min-h-screen bg-[#fafaf9] py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <h2 className="text-2xl font-medium text-[#2c2c2c] mb-2">
              Worker created
            </h2>
            <p className="text-[#6b6b6b] text-base">
              Review the preview and activate when ready
            </p>
          </div>

          <div className="space-y-8 mb-12">
            <div className="space-y-6 border-b border-[#e5e5e5] pb-8">
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <div>
                  <div className="text-[#6b6b6b] text-sm mb-1">Name</div>
                  <div className="text-[#2c2c2c]">{preview.worker.name}</div>
                </div>
                <div>
                  <div className="text-[#6b6b6b] text-sm mb-1">Schedule</div>
                  <div className="text-[#2c2c2c]">{preview.worker.configuration.interval}</div>
                </div>
                <div>
                  <div className="text-[#6b6b6b] text-sm mb-1">Recipients</div>
                  <div className="text-[#2c2c2c]">{preview.worker.configuration.recipients.join(", ")}</div>
                </div>
                <div>
                  <div className="text-[#6b6b6b] text-sm mb-1">Style</div>
                  <div className="text-[#2c2c2c]">{preview.worker.configuration.style}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[#6b6b6b] text-sm mb-6">
                {preview.preview.note}
              </div>
              <div className="space-y-8">
                {preview.preview.emails.map((email, idx) => (
                  <div key={idx} className="space-y-3 pb-8 border-b border-[#e5e5e5] last:border-0">
                    <div className="text-[#6b6b6b] text-sm">
                      To: {email.recipient}
                    </div>
                    <div className="text-[#2c2c2c] font-medium">
                      {email.subject}
                    </div>
                    <div className="text-[#2c2c2c] text-[15px] leading-relaxed whitespace-pre-line">
                      {email.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleEditAndRegenerate}
              className="px-5 py-2.5 text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm"
            >
              ← Edit
            </button>
            <button
              onClick={handleActivate}
              className="flex-1 px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-colors text-sm"
            >
              Go to worker
            </button>
            <Link
              href="/workers"
              className="px-5 py-2.5 text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm"
            >
              All workers
            </Link>
          </div>
        </div>
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

        <div className="mb-12">
          <h1 className="text-2xl font-medium text-[#2c2c2c] mb-2">
            Create a worker
          </h1>
          <p className="text-[#6b6b6b] text-base">
            Describe what you want in plain English
          </p>
        </div>

        <div className="space-y-12">

          {/* Worker Type Selection */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-4">
              Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {WORKER_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setSelectedType(type.value)}
                  className={`text-left px-4 py-3 transition-all ${selectedType === type.value
                    ? "bg-[#2c2c2c] text-white"
                    : "bg-white border border-[#e5e5e5] text-[#2c2c2c] hover:border-[#2c2c2c]"
                    }`}
                >
                  <div className="font-medium text-sm mb-1">
                    {type.label}
                  </div>
                  <div className={`text-xs ${selectedType === type.value ? "text-[#d4d4d4]" : "text-[#6b6b6b]"}`}>
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-3">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly client check-in"
              className="w-full px-0 py-2 border-b border-[#e5e5e5] focus:outline-none focus:border-[#2c2c2c] bg-transparent text-[#2c2c2c] placeholder:text-[#a3a3a3] transition-colors"
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-3">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Send a weekly check-in asking how their project is going"
              rows={4}
              className="w-full px-0 py-2 border-b border-[#e5e5e5] focus:outline-none focus:border-[#2c2c2c] bg-transparent text-[#2c2c2c] placeholder:text-[#a3a3a3] resize-none transition-colors leading-relaxed"
            />
          </div>

          {/* Sender Name Input */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-3">
              Your name <span className="text-[#a3a3a3]">(optional)</span>
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Alex Johnson"
              className="w-full px-0 py-2 border-b border-[#e5e5e5] focus:outline-none focus:border-[#2c2c2c] bg-transparent text-[#2c2c2c] placeholder:text-[#a3a3a3] transition-colors"
            />
          </div>

          {/* Style Selection */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-3">
              Style
            </label>
            <div className="flex gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setSelectedStyle(style.value)}
                  className={`px-4 py-2 text-sm transition-all ${selectedStyle === style.value
                    ? "bg-[#2c2c2c] text-white"
                    : "bg-white border border-[#e5e5e5] text-[#2c2c2c] hover:border-[#2c2c2c]"
                    }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients Selection - Tag Input */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-3">
              Recipients
            </label>

            {/* Tag Display */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {recipients.map((email) => (
                  <div
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-[#f5f5f5] text-[#2c2c2c] text-sm"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeRecipient(email)}
                      className="text-[#6b6b6b] hover:text-[#2c2c2c]"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tag Input */}
            <input
              type="text"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={handleRecipientKeyDown}
              placeholder="name@example.com"
              className="w-full px-0 py-2 border-b border-[#e5e5e5] focus:outline-none focus:border-[#2c2c2c] bg-transparent text-[#2c2c2c] placeholder:text-[#a3a3a3] transition-colors"
            />
            <p className="text-xs text-[#6b6b6b] mt-2">
              Press Enter to add
            </p>
          </div>

          {/* Additional Context - File Upload */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-3">
              Context <span className="text-[#a3a3a3]">(optional)</span>
            </label>

            {/* Uploaded Files Display */}
            {uploadedFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between py-2 border-b border-[#e5e5e5]"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-[#2c2c2c]">
                        {file.name}
                      </p>
                      <p className="text-xs text-[#6b6b6b]">
                        {file.size.toLocaleString()} chars
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file.name)}
                      className="ml-3 text-[#6b6b6b] hover:text-[#2c2c2c]"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* File Upload Input */}
            <div className="border border-dashed border-[#e5e5e5] p-8 text-center hover:border-[#2c2c2c] transition-colors cursor-pointer">
              <input
                type="file"
                id="context-files"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".txt,.md,.json,.csv,.xml,.html"
              />
              <label
                htmlFor="context-files"
                className="cursor-pointer block"
              >
                <p className="text-sm text-[#6b6b6b] mb-1">
                  Upload files
                </p>
                <p className="text-xs text-[#a3a3a3]">
                  10,000 character limit per file
                </p>
              </label>
            </div>
          </div>

          {/* Create Button */}
          <div className="pt-8">
            <button
              onClick={() => handleCreate()}
              disabled={!selectedType || !description || loading}
              className={`w-full px-5 py-3 text-sm transition-all ${!selectedType || !description || loading
                ? "bg-[#e5e5e5] text-[#a3a3a3] cursor-not-allowed"
                : "bg-[#2c2c2c] text-white hover:bg-[#3c3c3c]"
                }`}
            >
              {loading ? "Creating..." : "Create worker"}
            </button>
          </div>
        </div>

        {/* Interval Warning Modal */}
        {showIntervalWarning && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white p-8 max-w-md w-full border border-[#e5e5e5] shadow-2xl">
              <h3 className="text-lg font-medium text-[#2c2c2c] mb-3">
                Interval notice
              </h3>
              <p className="text-[#6b6b6b] text-sm mb-6 leading-relaxed">
                Scheduling intervals less than 1 minute will be rounded up to 1 minute due to cron limitations. Continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelInterval}
                  className="flex-1 px-5 py-2.5 border border-[#e5e5e5] text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmInterval}
                  className="flex-1 px-5 py-2.5 bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] transition-all text-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
