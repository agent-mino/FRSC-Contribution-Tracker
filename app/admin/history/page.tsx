import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import ImportHistoryManager from "@/components/ImportHistoryManager";

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
          was already imported. Deleting an import removes only that file's entries from each
          affected member's record — nothing else they have on file is touched.
        </p>
        <ImportHistoryManager imports={imports ?? []} uploaderName={uploaderName} />
      </div>
    </div>
  );
}
