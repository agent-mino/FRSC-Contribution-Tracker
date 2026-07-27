"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="page" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="masthead" style={{ display: "block", textAlign: "center", border: "none" }}>
        <h1>AGAPE Cooperative Ledger</h1>
      </div>
      <div className="card">
        <h2>Reset your password</h2>
        {sent ? (
          <p className="muted">
            If an account exists for <strong>{email}</strong>, a reset link has been sent. Click
            it to choose a new password, then <Link href="/login">sign in</Link>.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
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
              {error && <p className="error-text">{error}</p>}
              <button type="submit" disabled={loading} style={{ width: "100%" }}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
              <Link href="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
