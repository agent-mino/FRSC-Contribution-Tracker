import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";
import NotificationBell from "./NotificationBell";

export default async function AdminNav({ active }: { active: "import" | "members" | "requests" | "history" | "alerts" }) {
  const supabase = createClient();
  const { data: pending } = await supabase
    .from("membership_requests")
    .select("id, name, coop_account_no, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const pendingRequests = pending ?? [];

  return (
    <>
      <div className="masthead">
        <div>
          <h1>AGAPE Cooperative Ledger</h1>
          <div className="sub">Admin</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <NotificationBell requests={pendingRequests} />
          <SignOutButton />
        </div>
      </div>
      <nav className="tabs">
        <Link href="/admin/import" className={active === "import" ? "active" : ""}>
          Import schedule
        </Link>
        <Link href="/admin/members" className={active === "members" ? "active" : ""}>
          Members
        </Link>
        <Link href="/admin/history" className={active === "history" ? "active" : ""}>
          Import history
        </Link>
        <Link href="/admin/alerts" className={active === "alerts" ? "active" : ""}>
          Alerts
        </Link>
        <Link href="/admin/requests" className={active === "requests" ? "active" : ""}>
          Requests
          {pendingRequests.length > 0 && (
            <span className="badge warn" style={{ marginLeft: 6 }}>{pendingRequests.length}</span>
          )}
        </Link>
      </nav>
    </>
  );
}
