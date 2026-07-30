import Link from "next/link";
import { Upload, Users, History, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";
import NotificationBell from "./NotificationBell";

export default async function AdminNav({ active }: { active: "import" | "members" | "requests" | "history" }) {
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
          <Upload size={18} aria-hidden="true" />
          Import
        </Link>
        <Link href="/admin/members" className={active === "members" ? "active" : ""}>
          <Users size={18} aria-hidden="true" />
          Members
        </Link>
        <Link href="/admin/history" className={active === "history" ? "active" : ""}>
          <History size={18} aria-hidden="true" />
          History
        </Link>
        <Link href="/admin/requests" className={active === "requests" ? "active" : ""}>
          <Bell size={18} aria-hidden="true" />
          Requests
          {pendingRequests.length > 0 && (
            <span className="badge warn">{pendingRequests.length}</span>
          )}
        </Link>
      </nav>
    </>
  );
}
