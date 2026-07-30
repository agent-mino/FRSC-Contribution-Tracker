import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { user };
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * GET /api/import/[id]
 * Returns exactly what deleting this import would affect, so the UI can
 * show a specific confirmation ("this will affect N members...") before
 * the admin commits to it.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();

  const { data: importRow, error: importErr } = await admin
    .from("monthly_imports")
    .select("*")
    .eq("id", params.id)
    .single();

  if (importErr || !importRow) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  const { data: affectedRows, error: txnErr } = await admin
    .from("deduction_transactions")
    .select("member_id")
    .eq("import_id", params.id);

  if (txnErr) {
    return NextResponse.json({ error: txnErr.message }, { status: 500 });
  }

  const affectedMemberCount = new Set((affectedRows ?? []).map((r) => r.member_id)).size;

  return NextResponse.json({
    import: importRow,
    affectedMemberCount,
    affectedTransactionCount: affectedRows?.length ?? 0,
    label: `${importRow.bank_name}${importRow.batch_label ? " — " + importRow.batch_label : ""} · ${MONTH_NAMES[importRow.month]} ${importRow.year}`,
  });
}

/**
 * DELETE /api/import/[id]
 * Deletes the monthly_imports row. deduction_transactions.import_id has
 * ON DELETE CASCADE, so every transaction row tied to this import is
 * removed too — which fires the AFTER DELETE trigger on
 * deduction_transactions (trg_deduction_transactions_balance), which
 * recomputes each affected member's balance per category. Members
 * themselves are never touched: only rows tied to this specific import_id
 * disappear, so any other months/imports/manual adjustments a member has
 * are completely unaffected.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();

  const { data: importRow } = await admin
    .from("monthly_imports")
    .select("id")
    .eq("id", params.id)
    .single();

  if (!importRow) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  const { error } = await admin.from("monthly_imports").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
