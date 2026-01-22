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
          href={`/workers/${workerId}`}
          className="inline-block text-[#6b6b6b] hover:text-[#2c2c2c] mb-12 transition-colors text-sm"
        >
          ← Worker
        </Link>

        <div className="mb-12">
          <h1 className="text-2xl font-medium text-[#2c2c2c] mb-2">
            Edit worker
          </h1>
          <p className="text-[#6b6b6b] text-base">
            Update your worker configuration
          </p>
        </div>

        <div className="space-y-12">
          {/* Worker Type Display (Read-only) */}
          <div className="p-4 border border-[#e5e5e5] bg-[#f5f5f5]">
            <div className="text-xs text-[#a3a3a3] mb-1">Worker type (cannot be changed)</div>
            <div className="text-sm text-[#2c2c2c]">{worker.type}</div>
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
              placeholder="Describe what this worker should do"
              rows={4}
              className="w-full px-0 py-2 border-b border-[#e5e5e5] focus:outline-none focus:border-[#2c2c2c] bg-transparent text-[#2c2c2c] placeholder:text-[#a3a3a3] resize-none transition-colors leading-relaxed"
            />
          </div>

          {/* Recipients Selection - Tag Input */}
          <div>
            <label className="block text-[#6b6b6b] text-sm mb-3">
              Recipients
            </label>

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

          {/* Save Button */}
          <div className="flex gap-3 pt-8">
            <Link
              href={`/workers/${workerId}`}
              className="px-5 py-2.5 text-[#2c2c2c] hover:bg-[#f5f5f5] transition-colors text-sm"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={!name || !description || recipients.length === 0 || saving}
              className={`flex-1 px-5 py-2.5 text-sm transition-colors ${
                !name || !description || recipients.length === 0 || saving
                  ? "bg-[#e5e5e5] text-[#a3a3a3] cursor-not-allowed"
                  : "bg-[#2c2c2c] text-white hover:bg-[#3c3c3c]"
              }`}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
