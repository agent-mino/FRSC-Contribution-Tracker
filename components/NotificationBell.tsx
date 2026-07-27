"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PendingRequest {
  id: string;
  name: string;
  coop_account_no: string;
  created_at: string;
}

export default function NotificationBell({ requests }: { requests: PendingRequest[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function act(id: string, action: "accept" | "decline") {
    setActingId(id);
    try {
      const res = await fetch(`/api/requests/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className="secondary"
        onClick={() => setOpen((v) => !v)}
        style={{ position: "relative", padding: "8px 12px" }}
        aria-label="Notifications"
      >
        🔔
        {requests.length > 0 && (
          <span
            style={{
              position: "absolute", top: -4, right: -4,
              background: "var(--danger)", color: "#fff",
              borderRadius: "100px", fontSize: 10, fontWeight: 700,
              minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {requests.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            width: 320, maxHeight: 400, overflowY: "auto",
            background: "var(--paper-raised)", border: "1px solid var(--line)",
            borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50,
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13 }}>
            Signup requests
          </div>
          {requests.length === 0 ? (
            <p className="muted" style={{ padding: 14, fontSize: 13, margin: 0 }}>No pending requests.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                  <strong>{r.name}</strong> has sent a request
                  <span className="muted" style={{ display: "block", fontSize: 12 }}>{r.coop_account_no}</span>
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    disabled={actingId === r.id}
                    onClick={() => act(r.id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    className="secondary"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    disabled={actingId === r.id}
                    onClick={() => act(r.id, "decline")}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
          <div style={{ padding: "8px 14px" }}>
            <Link href="/admin/requests" style={{ fontSize: 12 }} onClick={() => setOpen(false)}>
              View all requests →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
