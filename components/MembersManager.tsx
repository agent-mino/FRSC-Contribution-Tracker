"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingButton from "./LoadingButton";

export interface MemberRow {
  id: string;
  coop_account_no: string;
  name: string;
  bank_name: string | null;
  bank_account_no: string | null;
  status: string;
  hasLogin: boolean;
  balances: { savings: number; loan: number; electronic: number; other: number };
}

function naira(n: number | null | undefined) {
  return "₦" + (n ?? 0).toLocaleString("en-NG");
}

export default function MembersManager({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [coopAccountNo, setCoopAccountNo] = useState("");
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [createLoginNow, setCreateLoginNow] = useState(false);
  const [loginMode, setLoginMode] = useState<"invite" | "manual">("invite");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loginFormForId, setLoginFormForId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MemberRow | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coopAccountNo, name, bankName, bankAccountNo,
          loginEmail: createLoginNow ? loginEmail : undefined,
          loginMode: createLoginNow ? loginMode : undefined,
          loginPassword: createLoginNow && loginMode === "manual" ? loginPassword : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member");
      if (data.loginError) {
        alert(`Member added, but: ${data.loginError}`);
      }
      setCoopAccountNo(""); setName(""); setBankName(""); setBankAccountNo("");
      setCreateLoginNow(false); setLoginEmail(""); setLoginPassword("");
      setShowAdd(false);
      router.refresh();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete ${label}? This permanently removes their entire contribution history. This can't be undone.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete member");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete member");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete(deleteAll = false) {
    const ids = Array.from(selectedIds);
    const confirmation = deleteAll ? prompt("Type DELETE ALL MEMBERS to permanently delete every member and their contribution history.") : "";
    if (deleteAll && confirmation !== "DELETE ALL MEMBERS") return;
    if (!deleteAll && ids.length === 0) {
      alert("Select at least one member.");
      return;
    }
    if (!deleteAll && !confirm(`Delete ${ids.length} selected member${ids.length === 1 ? "" : "s"}? This permanently removes their contribution history.`)) {
      return;
    }
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/members/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, deleteAll, confirmation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete members");
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete members");
    } finally {
      setBulkDeleting(false);
    }
  }

  const filtered = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.coop_account_no.toLowerCase().includes(q);
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filtered.forEach((m) => next.delete(m.id));
      else filtered.forEach((m) => next.add(m.id));
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <input
          placeholder="Search by name or account number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <LoadingButton
            className="secondary"
            loading={bulkDeleting}
            loadingText="Deleting…"
            onClick={() => handleBulkDelete(false)}
            disabled={selectedIds.size === 0}
          >
            Delete selected ({selectedIds.size})
          </LoadingButton>
          <LoadingButton
            className="secondary"
            loading={bulkDeleting}
            loadingText="Deleting…"
            onClick={() => handleBulkDelete(true)}
          >
            Delete all
          </LoadingButton>
          <button onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Cancel" : "+ Add member"}</button>
        </div>
      </div>

      {editing && (
        <EditMemberForm
          member={editing}
          onCancel={() => setEditing(null)}
          onDone={() => { setEditing(null); router.refresh(); }}
        />
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="card" style={{ background: "#fbfaf6" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field">
              <label>Cooperative account no.</label>
              <input value={coopAccountNo} onChange={(e) => setCoopAccountNo(e.target.value)} placeholder="ACS-201" required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Bank (optional)</label>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="UBA" />
            </div>
            <div className="field">
              <label>Bank account no. (optional)</label>
              <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400, marginBottom: 12 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={createLoginNow}
              onChange={(e) => setCreateLoginNow(e.target.checked)}
            />
            Create a login for them now (skip the signup request)
          </label>

          {createLoginNow && (
            <LoginModeFields
              mode={loginMode} setMode={setLoginMode}
              email={loginEmail} setEmail={setLoginEmail}
              password={loginPassword} setPassword={setLoginPassword}
            />
          )}

          {addError && <p className="error-text">{addError}</p>}
          <LoadingButton type="submit" loading={adding} loadingText="Adding…">Add member</LoadingButton>
        </form>
      )}

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  aria-label="Select all visible members"
                />
              </th>
              <th>Coop A/C</th>
              <th>Name</th>
              <th>Bank</th>
              <th>Status</th>
              <th>Login</th>
              <th className="num">Savings</th>
              <th className="num">Loan repaid</th>
              <th className="num">Electronic</th>
              <th className="num">Other</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <Fragment key={m.id}>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelected(m.id)}
                      aria-label={`Select ${m.name}`}
                    />
                  </td>
                  <td><Link href={`/admin/member/${m.id}`}>{m.coop_account_no}</Link></td>
                  <td>{m.name}</td>
                  <td>{m.bank_name || "—"}</td>
                  <td><span className={`badge ${m.status === "active" ? "ok" : "warn"}`}>{m.status}</span></td>
                  <td>
                    <span className={`badge ${m.hasLogin ? "ok" : "warn"}`}>
                      {m.hasLogin ? "Linked" : "Not linked"}
                    </span>
                  </td>
                  <td className="num">{naira(m.balances.savings)}</td>
                  <td className="num">{naira(m.balances.loan)}</td>
                  <td className="num">{naira(m.balances.electronic)}</td>
                  <td className="num">{naira(m.balances.other)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!m.hasLogin && (
                        <button
                          className="secondary"
                          style={{ padding: "5px 10px", fontSize: 12 }}
                          onClick={() => setLoginFormForId(loginFormForId === m.id ? null : m.id)}
                        >
                          Create login
                        </button>
                      )}
                      <button
                        className="secondary"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={() => setEditing(m)}
                      >
                        Edit
                      </button>
                      <button
                        className="secondary"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        disabled={deletingId === m.id}
                        onClick={() => handleDelete(m.id, `${m.name} (${m.coop_account_no})`)}
                      >
                        {deletingId === m.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
                {loginFormForId === m.id && (
                  <tr>
                    <td colSpan={11} style={{ background: "#fbfaf6" }}>
                      <CreateLoginInlineForm
                        memberId={m.id}
                        onDone={() => { setLoginFormForId(null); router.refresh(); }}
                        onCancel={() => setLoginFormForId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No members match &quot;{query}&quot;.</p>}
      </div>
    </div>
  );
}

function LoginModeFields({
  mode, setMode, email, setEmail, password, setPassword,
}: {
  mode: "invite" | "manual"; setMode: (m: "invite" | "manual") => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
          <input type="radio" style={{ width: "auto" }} checked={mode === "invite"} onChange={() => setMode("invite")} />
          Send invite email
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
          <input type="radio" style={{ width: "auto" }} checked={mode === "manual"} onChange={() => setMode("manual")} />
          Set temporary password myself
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mode === "manual" ? "1fr 1fr" : "1fr", gap: 14 }}>
        <div className="field">
          <label>Login email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {mode === "manual" && (
          <div className="field">
            <label>Temporary password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 8 characters — share with them securely"
              required
            />
          </div>
        )}
      </div>
      {mode === "invite" && (
        <p className="muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}>
          They&apos;ll get an email with a link to set their own password. Requires email sending
          to be working on your Supabase project.
        </p>
      )}
    </div>
  );
}

function CreateLoginInlineForm({
  memberId, onDone, onCancel,
}: { memberId: string; onDone: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<"invite" | "manual">("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${memberId}/create-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode, password: mode === "manual" ? password : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create login");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "12px 4px" }}>
      <LoginModeFields mode={mode} setMode={setMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} />
      <div style={{ display: "flex", gap: 8 }}>
        <LoadingButton type="submit" loading={loading} loadingText="Creating…">Create login</LoadingButton>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}

function EditMemberForm({
  member, onCancel, onDone,
}: { member: MemberRow; onCancel: () => void; onDone: () => void }) {
  const [coopAccountNo, setCoopAccountNo] = useState(member.coop_account_no);
  const [name, setName] = useState(member.name);
  const [bankName, setBankName] = useState(member.bank_name ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(member.bank_account_no ?? "");
  const [status, setStatus] = useState(member.status === "inactive" ? "inactive" : "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coopAccountNo, name, bankName, bankAccountNo, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save member");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ background: "#fbfaf6" }}>
      <h2>Edit member</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div className="field">
          <label>Cooperative account no.</label>
          <input value={coopAccountNo} onChange={(e) => setCoopAccountNo(e.target.value)} required />
        </div>
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Bank</label>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </div>
        <div className="field">
          <label>Bank account no.</label>
          <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <LoadingButton type="submit" loading={saving} loadingText="Saving…">Save changes</LoadingButton>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
