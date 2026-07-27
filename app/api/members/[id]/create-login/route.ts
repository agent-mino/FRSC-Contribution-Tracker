import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMemberLogin } from "@/lib/createMemberLogin";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email, password, mode } = (await req.json()) as {
    email?: string; password?: string; mode?: "invite" | "manual";
  };
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member, error: memberErr } = await admin
    .from("members")
    .select("id, name")
    .eq("id", params.id)
    .single();
  if (memberErr || !member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const result = await createMemberLogin({
    memberId: member.id,
    memberName: member.name,
    email,
    mode: mode === "manual" ? "manual" : "invite",
    password,
    origin: req.nextUrl.origin,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
