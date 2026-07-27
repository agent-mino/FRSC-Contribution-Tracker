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

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  const deleteAll = Boolean(body.deleteAll);
  const confirmation = String(body.confirmation || "");

  if (deleteAll && confirmation !== "DELETE ALL MEMBERS") {
    return NextResponse.json(
      { error: "Type DELETE ALL MEMBERS to confirm deleting every member and their ledger history." },
      { status: 400 }
    );
  }
  if (!deleteAll && ids.length === 0) {
    return NextResponse.json({ error: "Select at least one member to delete." }, { status: 400 });
  }

  const admin = createAdminClient();
  const query = admin.from("members").delete();
  const { error, count } = deleteAll
    ? await query.neq("id", "00000000-0000-0000-0000-000000000000")
    : await query.in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deletedCount: count ?? (deleteAll ? null : ids.length) });
}
