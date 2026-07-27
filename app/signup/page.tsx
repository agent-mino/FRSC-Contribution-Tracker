"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coopAccountNo, setCoopAccountNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function submitRequest(userId: string) {
    const res = await fetch("/api/signup-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, email, coopAccountNo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit your request");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error("Signup didn't return a user — please try again.");

      await submitRequest(data.user.id);

      if (!data.session) setNeedsConfirmation(true);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="page" style={{ maxWidth: 420, paddingTop: 80 }}>
        <div className="masthead" style={{ display: "block", textAlign: "center", border: "none" }}>
          <h1>AGAPE Cooperative Ledger</h1>
        </div>
        <div className="card">
          <h2>Request submitted</h2>
          {needsConfirmation && (
            <p className="muted">
              First, check <strong>{email}</strong> for a confirmation link and click it.
            </p>
          )}
          <p className="muted">
            Your admin has been notified with your name and account number
            (<strong>{coopAccountNo}</strong>) and will approve or decline your request. Once
            approved, sign in to see your records.
          </p>
          <Link href="/login" className="btn" style={{ display: "inline-block", marginTop: 8, textDecoration: "none" }}>
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="masthead" style={{ display: "block", textAlign: "center", border: "none" }}>
        <h1>AGAPE Cooperative Ledger</h1>
        <div className="sub">Federal Road Safety Corps · Contribution Ledger</div>
      </div>
      <div className="card">
        <h2>Request access</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="coop">Cooperative account number</label>
            <input
              id="coop"
              required
              placeholder="e.g. ACS-002"
              value={coopAccountNo}
              onChange={(e) => setCoopAccountNo(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Submitting…" : "Submit request"}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Your admin reviews every new request before you can see any records.
          Already approved? <Link href="/login">Sign in</Link>.
        </p>
      </div>
    </div>
  );
}
