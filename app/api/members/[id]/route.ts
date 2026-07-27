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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const coopAccountNo = String(body.coopAccountNo || "").trim();
  const name = String(body.name || "").trim();
  const bankName = String(body.bankName || "").trim() || null;
  const bankAccountNo = String(body.bankAccountNo || "").trim() || null;
  const status = body.status === "inactive" ? "inactive" : "active";

  if (!coopAccountNo || !name) {
    return NextResponse.json({ error: "Account number and name are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .update({
      coop_account_no: coopAccountNo,
      name,
      bank_name: bankName,
      bank_account_no: bankAccountNo,
      status,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    const message = error.code === "23505"
      ? `A member with account number "${coopAccountNo}" already exists.`
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ success: true, member });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const admin = createAdminClient();

  // members -> deduction_transactions is ON DELETE CASCADE (their ledger goes too)
  // members -> profiles.member_id is ON DELETE SET NULL (their login survives, unlinked)
  const { error } = await admin.from("members").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
