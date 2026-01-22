"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Worker {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  configuration: {
    interval: string;
    recipients: string[];
    tone?: string;
    style?: string;
    customInstructions?: string;
    subjectTemplate?: string;
    lifespan?: number;
  };
  information: string[];
}

export default function EditWorkerPage() {
  const params = useParams();
  const router = useRouter();
  const workerId = params.id as string;

  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; size: number }>>([]);

  useEffect(() => {
    fetchWorker();
  }, [workerId]);

  const fetchWorker = async () => {
    try {
      const res = await fetch(`/api/workers/${workerId}`);
      const data = await res.json();

      if (res.ok) {
        setWorker(data.worker);
        setName(data.worker.name);
        setDescription(data.worker.description);
        setRecipients(data.worker.configuration.recipients || []);

        // Convert existing information array to file format
        if (data.worker.information && data.worker.information.length > 0) {
          setUploadedFiles(
            data.worker.information.map((info: string, idx: number) => ({
              name: `context-${idx + 1}.txt`,
              content: info,
              size: info.length,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch worker:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && recipientInput.trim()) {
      e.preventDefault();
      const email = recipientInput.trim();

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

    const MAX_CHARS_PER_FILE = 10000;

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

    e.target.value = "";
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleSave = async () => {
    if (!name || !description) {
      alert("Name and description are required");
      return;
    }

    if (recipients.length === 0) {
      alert("Please add at least one recipient");
      return;
    }

    setSaving(true);
    try {
      const contextArray = uploadedFiles.map((file) => file.content);

      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          recipients,
          information: contextArray.length > 0 ? contextArray : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/workers/${workerId}`);
      } else {
        alert(`Error: ${data.error || data.message}`);
      }
    } catch (error) {
      console.error("Failed to update worker:", error);
      alert("Failed to update worker");
    } finally {
      setSaving(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/workers/${workerId}`}
          className="inline-block text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          ← Back to Worker
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Edit Worker
          </h1>
          <p className="text-slate-600 mb-8">
            Update your worker configuration
          </p>

          {/* Worker Type Display (Read-only) */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">Worker Type (cannot be changed)</div>
            <div className="font-medium text-slate-900">{worker.type}</div>
          </div>

          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Worker Name
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
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              What should this worker do?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe in plain English what you want this worker to do."
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Recipients Selection - Tag Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Recipients <span className="text-red-500">*</span>
            </label>

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                {recipients.map((email) => (
                  <div
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 rounded-full text-sm shadow-sm"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeRecipient(email)}
                      className="text-slate-500 hover:text-red-600 font-bold"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <input
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleRecipientKeyDown}
                placeholder="Enter email address and press Enter to add"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-2">
                Press Enter after typing each email address to add it as a tag
              </p>
            </div>
          </div>

          {/* Additional Context - File Upload */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Additional Context <span className="text-slate-400">(optional)</span>
            </label>

            {uploadedFiles.length > 0 && (
              <div className="mb-3 space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {file.size.toLocaleString()} characters
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file.name)}
                      className="ml-3 text-red-500 hover:text-red-700 font-bold"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
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
                <div className="text-4xl mb-2">📄</div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Click to upload context files
                </p>
                <p className="text-xs text-slate-500">
                  Max 10,000 characters per file
                </p>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <Link
              href={`/workers/${workerId}`}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-center"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={!name || !description || recipients.length === 0 || saving}
              className={`flex-1 px-6 py-4 rounded-lg font-medium transition-all ${
                !name || !description || recipients.length === 0 || saving
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/20"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
