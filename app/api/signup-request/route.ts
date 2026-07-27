import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called right after client-side supabase.auth.signUp(). We can't rely on
// an RLS-respecting session client here because email confirmation may not
// be complete yet (no session exists until they click the confirmation
// link) — so instead we verify the supplied userId is real and its email
// matches what was submitted, using the admin client, before writing.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = String(body.userId || "");
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const coopAccountNo = String(body.coopAccountNo || "").trim();

  if (!userId || !name || !email || !coopAccountNo) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: "Could not verify your account. Please sign up again." }, { status: 400 });
  }
  if (authUser.user.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Email doesn't match your signed-up account." }, { status: 400 });
  }

  // If they already have a linked profile, no request is needed.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("member_id")
    .eq("id", userId)
    .maybeSingle();
  if (existingProfile?.member_id) {
    return NextResponse.json({ error: "Your account is already linked." }, { status: 400 });
  }

  const { error } = await admin.from("membership_requests").upsert(
    {
      auth_user_id: userId,
      name,
      email,
      coop_account_no: coopAccountNo,
      status: "pending",
      member_id: null,
      reviewed_at: null,
      reviewed_by: null,
    },
    { onConflict: "auth_user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
