"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoadingButton from "./LoadingButton";

export interface RequestRow {
  id: string;
  name: string;
  email: string;
  coop_account_no: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  reviewed_at: string | null;
}
interface MemberMatch {
  id: string;
  name: string;
  coop_account_no: string;
}
interface WarningState {
  requestId: string;
  message: string;
  allowCreateNewMember?: boolean;
  allowNameMismatch?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function RequestsManager({
  requests,
  members,
}: {
  requests: RequestRow[];
  members: MemberMatch[];
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [warning, setWarning] = useState<WarningState | null>(null);
  const memberByAccount = new Map(members.map((m) => [m.coop_account_no.trim().toUpperCase(), m]));

  async function act(id: string, action: "accept" | "decline", override?: Omit<WarningState, "requestId" | "message">) {
    setActingId(id);
    setWarning(null);
    try {
      const res = await fetch(`/api/requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "accept" ? JSON.stringify(override ?? {}) : undefined,
      });
      const data = await res.json();
      if (res.status === 409 && action === "accept") {
        setWarning({
          requestId: id,
          message: data.error || "Review this request before accepting.",
          allowCreateNewMember: data.warningKind === "new_member",
          allowNameMismatch: data.warningKind === "name_mismatch",
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setActingId(null);
    }
  }

  const shown = filter === "pending" ? requests.filter((r) => r.status === "pending") : requests;

  return (
    <div>
      <nav className="tabs" style={{ marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
        <button
          type="button"
          className={filter === "pending" ? "active" : ""}
          onClick={() => setFilter("pending")}
          style={{ background: "none", color: filter === "pending" ? "var(--forest-dark)" : "var(--muted)", border: "none", borderBottom: filter === "pending" ? "2px solid var(--gold)" : "2px solid transparent", padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Pending
        </button>
        <button
          type="button"
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
          style={{ background: "none", color: filter === "all" ? "var(--forest-dark)" : "var(--muted)", border: "none", borderBottom: filter === "all" ? "2px solid var(--gold)" : "2px solid transparent", padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          All
        </button>
      </nav>

      {shown.length === 0 ? (
        <p className="muted">No {filter === "pending" ? "pending" : ""} requests.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Account no.</th>
              <th>Submitted</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.coop_account_no}</td>
                <td>{formatDate(r.created_at)}</td>
                <td>
                  <RequestBadges request={r} member={memberByAccount.get(r.coop_account_no.trim().toUpperCase())} />
                </td>
                <td>
                  {r.status === "pending" && (
                    <div style={{ display: "grid", gap: 6 }}>
                      {warning?.requestId === r.id && (
                        <div style={{ maxWidth: 340 }}>
                          <p className="error-text" style={{ margin: "0 0 6px" }}>{warning.message}</p>
                          <LoadingButton
                            style={{ padding: "5px 10px", fontSize: 12 }}
                            loading={actingId === r.id}
                            loadingText="Accepting…"
                            onClick={() => act(r.id, "accept", {
                              allowCreateNewMember: warning.allowCreateNewMember,
                              allowNameMismatch: warning.allowNameMismatch,
                            })}
                          >
                            Accept with warning
                          </LoadingButton>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <LoadingButton
                          style={{ padding: "5px 10px", fontSize: 12 }}
                          loading={actingId === r.id && warning?.requestId !== r.id}
                          loadingText="Accepting…"
                          onClick={() => act(r.id, "accept")}
                        >
                          Accept
                        </LoadingButton>
                        <LoadingButton
                          className="secondary"
                          style={{ padding: "5px 10px", fontSize: 12 }}
                          loading={actingId === r.id && warning?.requestId !== r.id}
                          loadingText="Declining…"
                          onClick={() => act(r.id, "decline")}
                        >
                          Decline
                        </LoadingButton>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RequestBadges({ request, member }: { request: RequestRow; member?: MemberMatch }) {
  const staleDays = daysSince(request.created_at);
  const nameMismatch = member && normalize(member.name) !== normalize(request.name);
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      <span className={`badge ${request.status === "accepted" ? "ok" : request.status === "declined" ? "warn" : ""}`}>
        {request.status}
      </span>
      {request.status === "pending" && staleDays >= 2 && (
        <span className="badge warn">{staleDays}d pending</span>
      )}
      {request.status === "pending" && !member && (
        <span className="badge warn">New record</span>
      )}
      {request.status === "pending" && member && !nameMismatch && (
        <span className="badge ok">Matched</span>
      )}
      {request.status === "pending" && nameMismatch && (
        <span
          className="badge warn"
          title={`Existing member name: ${member.name}`}
        >
          Name mismatch
        </span>
      )}
    </div>
  );
}
