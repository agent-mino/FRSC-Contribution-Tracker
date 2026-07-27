import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import RequestsManager, { type RequestRow } from "@/components/RequestsManager";

export default async function AdminRequestsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: requests } = await supabase
    .from("membership_requests")
    .select("*")
    .order("created_at", { ascending: false });
  const accounts = Array.from(new Set((requests ?? []).map((r) => r.coop_account_no).filter(Boolean)));
  const { data: members } = accounts.length
    ? await supabase
        .from("members")
        .select("id, name, coop_account_no")
        .in("coop_account_no", accounts)
    : { data: [] as { id: string; name: string; coop_account_no: string }[] };

  return (
    <div className="page">
      <AdminNav active="requests" />
      <div className="card">
        <h2>Signup requests</h2>
        <RequestsManager
          requests={(requests ?? []) as RequestRow[]}
          members={(members ?? []) as Array<{ id: string; name: string; coop_account_no: string }>}
        />
      </div>
    </div>
  );
}
