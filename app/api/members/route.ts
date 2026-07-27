import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMemberLogin } from "@/lib/createMemberLogin";

export async function POST(req: NextRequest) {
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
  const coopAccountNo = String(body.coopAccountNo || "").trim();
  const name = String(body.name || "").trim();
  const bankName = String(body.bankName || "").trim() || null;
  const bankAccountNo = String(body.bankAccountNo || "").trim() || null;
  const loginEmail = String(body.loginEmail || "").trim();
  const loginPassword = String(body.loginPassword || "");
  const loginMode = body.loginMode === "manual" ? "manual" : "invite";

  if (!coopAccountNo || !name) {
    return NextResponse.json({ error: "Account number and name are required" }, { status: 400 });
  }
  if (loginEmail && loginMode === "manual" && (!loginPassword || loginPassword.length < 8)) {
    return NextResponse.json(
      { error: "Login password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .insert({
      coop_account_no: coopAccountNo,
      name,
      bank_name: bankName,
      bank_account_no: bankAccountNo,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505"
      ? `A member with account number "${coopAccountNo}" already exists.`
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (loginEmail) {
    const result = await createMemberLogin({
      memberId: member.id,
      memberName: name,
      email: loginEmail,
      mode: loginMode,
      password: loginPassword,
      origin: req.nextUrl.origin,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: true, member, loginError: `Member was created, but the login could not be: ${result.error} — add it from the Members list instead.` },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ success: true, member });
}
