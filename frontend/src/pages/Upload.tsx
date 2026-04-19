import React, { useState, useRef } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import { apiUrl } from "../api";

export default function Upload() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!file) {
      setMessage({ kind: "error", text: "Please choose a photo." });
      return;
    }
    if (!participantName.trim()) {
      setMessage({ kind: "error", text: "Please provide participant name." });
      return;
    }
    if (!reason.trim()) {
      setMessage({ kind: "error", text: "Please provide a reason for DQ." });
      return;
    }
    if (!token) {
      setMessage({ kind: "error", text: "Not signed in." });
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("participantName", participantName.trim());
      if (participantId.trim()) {
        form.append("participantId", participantId.trim());
      }
      form.append("reason", reason.trim());

      const res = await fetch(apiUrl("/api/submissions"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Submission failed");
      }
      const data = await res.json();
      setMessage({
        kind: "success",
        text: `Submitted! Your DQ count is now ${data.score}.`,
      });
      setFile(null);
      setParticipantName("");
      setParticipantId("");
      setReason("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "Submission failed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-xl mx-auto pt-16 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Upload Evidence</h1>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-md p-8 space-y-6"
        >
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-gray-400 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <p className="text-gray-700 font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-gray-500 text-lg">Click to upload a photo</p>
                <p className="text-gray-400 text-sm mt-1">JPG, PNG, HEIC</p>
              </>
            )}
          </div>

          <div>
            <label
              htmlFor="participantName"
              className="block text-lg font-semibold text-gray-700 mb-2"
            >
              Participant Name
            </label>
            <input
              id="participantName"
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="Enter participant's name"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="participantId"
              className="block text-lg font-semibold text-gray-700 mb-2"
            >
              Participant ID (Optional)
            </label>
            <input
              id="participantId"
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              placeholder="Enter participant ID (optional)"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="reason"
              className="block text-lg font-semibold text-gray-700 mb-2"
            >
              Brief reason for DQ
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="What species of cheating behavior hath you witnessed?"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
          </div>

          {message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                message.kind === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gray-900 text-white text-lg font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
