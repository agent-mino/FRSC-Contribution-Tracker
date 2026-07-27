import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function AdminHistoryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: imports } = await supabase
    .from("monthly_imports")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("uploaded_at", { ascending: false });

  const uploaderIds = Array.from(new Set((imports ?? []).map((i) => i.uploaded_by).filter(Boolean)));
  const { data: uploaders } = uploaderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", uploaderIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const uploaderName: Record<string, string> = {};
  (uploaders ?? []).forEach((u) => (uploaderName[u.id] = u.full_name || "Admin"));

  return (
    <div className="page">
      <AdminNav active="history" />
      <div className="card">
        <h2>Import history ({imports?.length ?? 0})</h2>
        <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
          Every bank schedule that's been uploaded, in case anyone asks whether a month's file
          was already imported.
        </p>
        {!imports || imports.length === 0 ? (
          <p className="muted">No imports yet — go to Import schedule to upload your first file.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Bank</th>
                <th>Batch</th>
                <th>File</th>
                <th className="num">Rows</th>
                <th className="num">Mismatches</th>
                <th>Uploaded by</th>
                <th>Uploaded at</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id}>
                  <td>{MONTH_NAMES[imp.month]} {imp.year}</td>
                  <td>{imp.bank_name}</td>
                  <td>{imp.batch_label || "—"}</td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{imp.source_filename}</td>
                  <td className="num">{imp.row_count}</td>
                  <td className="num">
                    {imp.mismatch_count > 0 ? (
                      <span className="badge warn">{imp.mismatch_count}</span>
                    ) : (
                      <span className="badge ok">0</span>
                    )}
                  </td>
                  <td>{imp.uploaded_by ? uploaderName[imp.uploaded_by] || "—" : "—"}</td>
                  <td>{new Date(imp.uploaded_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
