"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "savings", label: "Savings" },
  { value: "loan", label: "Loan" },
  { value: "electronic", label: "Electronic" },
  { value: "other", label: "Other" },
];

export default function AdjustmentForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState("savings");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!numAmount) {
      setError("Enter a non-zero amount.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${memberId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, amount: numAmount, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post adjustment");
      setAmount("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Amount (₦)</label>
        <input
          type="number"
          step="0.01"
          placeholder="-5000 or 5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Note</label>
        <input
          placeholder="Reason for this adjustment"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <button type="submit" disabled={loading}>{loading ? "Posting…" : "Post"}</button>
      {error && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{error}</p>}
    </form>
  );
}
