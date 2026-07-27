"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  status: "pending" | "declined" | null;
  defaultName: string;
  defaultEmail: string;
  userId: string;
}

export default function RequestStatusPanel({ status, defaultName, defaultEmail, userId }: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [coopAccountNo, setCoopAccountNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, email: defaultEmail, coopAccountNo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (status === "pending") {
    return (
      <p className="muted">
        Your request is waiting for your admin to review it. You&apos;ll be able to see your
        records here as soon as it&apos;s approved.
      </p>
    );
  }

  if (status === "declined") {
    return (
      <>
        <p className="muted" style={{ marginBottom: 16 }}>
          Your last request was declined. If you think this was a mistake, check your details
          and submit again, or contact your admin.
        </p>
        <RequestForm
          name={name} setName={setName}
          coopAccountNo={coopAccountNo} setCoopAccountNo={setCoopAccountNo}
          onSubmit={handleSubmit} loading={loading} error={error}
        />
      </>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginBottom: 16 }}>
        Enter your cooperative account number to request access to your records.
      </p>
      <RequestForm
        name={name} setName={setName}
        coopAccountNo={coopAccountNo} setCoopAccountNo={setCoopAccountNo}
        onSubmit={handleSubmit} loading={loading} error={error}
      />
    </>
  );
}

function RequestForm({
  name, setName, coopAccountNo, setCoopAccountNo, onSubmit, loading, error,
}: {
  name: string; setName: (v: string) => void;
  coopAccountNo: string; setCoopAccountNo: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void; loading: boolean; error: string | null;
}) {
  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 360 }}>
      <div className="field">
        <label>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label>Cooperative account number</label>
        <input value={coopAccountNo} onChange={(e) => setCoopAccountNo(e.target.value)} placeholder="e.g. ACS-002" required />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit request"}</button>
    </form>
  );
}
