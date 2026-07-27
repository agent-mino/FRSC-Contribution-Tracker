"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email or password is incorrect."
          : error.message
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="page" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="masthead" style={{ display: "block", textAlign: "center", border: "none" }}>
        <h1>AGAPE Cooperative Ledger</h1>
        <div className="sub">Federal Road Safety Corps · Contribution Ledger</div>
      </div>
      <div className="card">
        <h2>Sign in</h2>
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
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ textAlign: "right", marginBottom: 14 }}>
            <a href="/forgot-password" style={{ fontSize: 12 }}>Forgot password?</a>
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          Don&apos;t have an account yet? <a href="/signup">Sign up</a> with your email and link it
          to your cooperative account number.
        </p>
      </div>
    </div>
  );
}
