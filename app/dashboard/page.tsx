import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import RequestStatusPanel from "@/components/RequestStatusPanel";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function naira(n: number | null | undefined) {
  const v = n ?? 0;
  return "₦" + v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, member_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin/import");

  if (!profile?.member_id) {
    const { data: request } = await supabase
      .from("membership_requests")
      .select("status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return (
      <div className="page">
        <div className="masthead">
          <h1>AGAPE Cooperative Ledger</h1>
          <SignOutButton />
        </div>
        <div className="card">
          <h2>
            {request?.status === "pending"
              ? "Request pending"
              : request?.status === "declined"
              ? "Request declined"
              : "Request access"}
          </h2>
          <RequestStatusPanel
            status={(request?.status as "pending" | "declined" | undefined) ?? null}
            defaultName={profile?.full_name || ""}
            defaultEmail={user.email || ""}
            userId={user.id}
          />
        </div>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", profile.member_id)
    .single();

  const { data: balances } = await supabase
    .from("balances")
    .select("*")
    .eq("member_id", profile.member_id);

  const { data: history } = await supabase
    .from("member_month_totals")
    .select("*")
    .eq("member_id", profile.member_id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  const balanceMap: Record<string, number> = {};
  (balances ?? []).forEach((b) => (balanceMap[b.category] = Number(b.running_balance)));

  return (
    <div className="page">
      <div className="masthead">
        <div>
          <h1>AGAPE Cooperative Ledger</h1>
          <div className="sub">
            {member?.name} · {member?.coop_account_no}
          </div>
        </div>
        <SignOutButton />
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Savings balance</div>
          <div className="value">{naira(balanceMap.savings)}</div>
        </div>
        <div className="stat">
          <div className="label">Loan repaid to date</div>
          <div className="value">{naira(balanceMap.loan)}</div>
        </div>
        <div className="stat">
          <div className="label">Electronic deductions</div>
          <div className="value">{naira(balanceMap.electronic)}</div>
        </div>
        <div className="stat">
          <div className="label">Other</div>
          <div className="value">{naira(balanceMap.other)}</div>
        </div>
      </div>

      <div className="card">
        <h2>Monthly history</h2>
        {!history || history.length === 0 ? (
          <p className="muted">No deductions have been recorded for you yet.</p>
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
