import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import AdjustmentForm from "@/components/AdjustmentForm";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function naira(n: number | null | undefined) {
  return "₦" + (n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AdminMemberPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: member } = await supabase.from("members").select("*").eq("id", params.id).single();
  if (!member) notFound();

  const { data: balances } = await supabase.from("balances").select("*").eq("member_id", params.id);
  const { data: history } = await supabase
    .from("member_month_totals")
    .select("*")
    .eq("member_id", params.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  const balanceMap: Record<string, number> = {};
  (balances ?? []).forEach((b) => (balanceMap[b.category] = Number(b.running_balance)));

  return (
    <div className="page">
      <AdminNav active="members" />
      <div className="card">
        <h2>{member.name}</h2>
        <p className="muted" style={{ marginTop: -10 }}>
          {member.coop_account_no} · {member.bank_name} · {member.bank_account_no}
        </p>
        <div className="stat-row">
          <div className="stat">
            <div className="label">Savings</div>
            <div className="value">{naira(balanceMap.savings)}</div>
          </div>
          <div className="stat">
            <div className="label">Loan repaid</div>
            <div className="value">{naira(balanceMap.loan)}</div>
          </div>
          <div className="stat">
            <div className="label">Electronic</div>
            <div className="value">{naira(balanceMap.electronic)}</div>
          </div>
          <div className="stat">
            <div className="label">Other</div>
            <div className="value">{naira(balanceMap.other)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Manual adjustment</h2>
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          Post a one-off debit or credit outside the monthly import — e.g. correcting an error
          or recording a manual payment. Use a negative amount for a debit/reversal.
        </p>
        <AdjustmentForm memberId={member.id} />
      </div>

      <div className="card">
        <h2>History</h2>
        {!history || history.length === 0 ? (
          <p className="muted">No transactions recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Savings</th>
                <th className="num">Loan</th>
                <th className="num">Electronic</th>
                <th className="num">Other</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={`${h.year}-${h.month}`}>
                  <td>{MONTH_NAMES[h.month]} {h.year}</td>
                  <td className="num">{naira(h.savings)}</td>
                  <td className="num">{naira(h.loan)}</td>
                  <td className="num">{naira(h.electronic)}</td>
                  <td className="num">{naira(h.other)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{naira(h.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
