import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import MembersManager, { type MemberRow } from "@/components/MembersManager";

export default async function AdminMembersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: members } = await supabase.from("members").select("*").order("name");
  const { data: balances } = await supabase.from("balances").select("*");
  const { data: profiles } = await supabase.from("profiles").select("member_id").not("member_id", "is", null);

  const balanceByMember: Record<string, Record<string, number>> = {};
  (balances ?? []).forEach((b) => {
    balanceByMember[b.member_id] ??= {};
    balanceByMember[b.member_id][b.category] = Number(b.running_balance);
  });

  const linkedMemberIds = new Set((profiles ?? []).map((p) => p.member_id));

  const rows: MemberRow[] = (members ?? []).map((m) => {
    const bal = balanceByMember[m.id] ?? {};
    return {
      id: m.id,
      coop_account_no: m.coop_account_no,
      name: m.name,
      bank_name: m.bank_name,
      bank_account_no: m.bank_account_no,
      status: m.status,
      hasLogin: linkedMemberIds.has(m.id),
      balances: {
        savings: bal.savings ?? 0,
        loan: bal.loan ?? 0,
        electronic: bal.electronic ?? 0,
        other: bal.other ?? 0,
      },
    };
  });

  return (
    <div className="page">
      <AdminNav active="members" />
      <div className="card">
        <h2>Members ({rows.length})</h2>
        <MembersManager members={rows} />
      </div>
    </div>
  );
}
