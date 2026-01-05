"use client";

import { useEffect, useState } from "react";

export default function InboxPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gmail/messages")
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading inbox...</div>;

  return (
    <div>
      <h1>Your Inbox</h1>
      {messages.map((msg) => {
        const subject = msg.payload.headers.find(
          (h: any) => h.name === "Subject"
        )?.value;
        const from = msg.payload.headers.find(
          (h: any) => h.name === "From"
        )?.value;

        return (
          <div key={msg.id} style={{ border: "1px solid #ccc", padding: 10, margin: 10 }}>
            <strong>{subject}</strong>
            <p>From: {from}</p>
            <small>ID: {msg.id}</small>
          </div>
        );
      })}
    </div>
  );
}