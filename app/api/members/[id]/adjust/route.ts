import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_CATEGORIES = ["savings", "loan", "electronic", "other"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { category, amount, note } = body as { category: string; amount: number; note?: string };

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "Amount must be a non-zero number" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { error } = await admin.from("deduction_transactions").insert({
    member_id: params.id,
    import_id: null,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    category,
    amount,
    note: note || null,
    created_by: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
