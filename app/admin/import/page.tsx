import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import ImportWizard from "@/components/ImportWizard";

export default async function AdminImportPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="page">
      <AdminNav active="import" />
      <div className="card">
        <h2>Import a monthly deduction schedule</h2>
        <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
          Drop the bank&apos;s Excel file. Any bank&apos;s column names are recognized automatically —
          you&apos;ll get a preview to check before anything is saved.
        </p>
        <ImportWizard />
      </div>
    </div>
  );
}
