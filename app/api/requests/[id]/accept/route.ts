import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const allowCreateNewMember = Boolean(body.allowCreateNewMember);
  const allowNameMismatch = Boolean(body.allowNameMismatch);

  const { data: request, error: reqErr } = await admin
    .from("membership_requests")
    .select("*")
    .eq("id", params.id)
    .single();
  if (reqErr || !request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: `This request was already ${request.status}.` }, { status: 400 });
  }

  // Find an existing member with this account number; create one if none exists,
  // so admin approval is a single click even if the member wasn't imported yet.
  let member;
  const { data: existingMember } = await admin
    .from("members")
    .select("*")
    .ilike("coop_account_no", request.coop_account_no)
    .maybeSingle();

  if (existingMember) {
    if (normalizeName(existingMember.name) !== normalizeName(request.name) && !allowNameMismatch) {
      return NextResponse.json(
        {
          error: "The submitted name does not match the existing member record for this account number.",
          warningKind: "name_mismatch",
          requestName: request.name,
          memberName: existingMember.name,
        },
        { status: 409 }
      );
    }
    member = existingMember;
  } else {
    if (!allowCreateNewMember) {
      return NextResponse.json(
        {
          error: "No existing member record matches this account number. Accepting will create a new member record.",
          warningKind: "new_member",
          requestName: request.name,
          coopAccountNo: request.coop_account_no,
        },
        { status: 409 }
      );
    }
    const { data: newMember, error: createErr } = await admin
      .from("members")
      .insert({ coop_account_no: request.coop_account_no, name: request.name })
      .select()
      .single();
    if (createErr || !newMember) {
      return NextResponse.json(
        { error: `Couldn't create a member record: ${createErr?.message}` },
        { status: 500 }
      );
    }
    member = newMember;
  }

  // Make sure no other login is already linked to this member.
  const { data: conflictingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("member_id", member.id)
    .neq("id", request.auth_user_id)
    .maybeSingle();
  if (conflictingProfile) {
    return NextResponse.json(
      { error: "This member record is already linked to a different login." },
      { status: 409 }
    );
  }

  const { error: profileErr } = await admin.from("profiles").upsert(
    { id: request.auth_user_id, role: "member", member_id: member.id, full_name: request.name },
    { onConflict: "id" }
  );
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const { error: updateErr } = await admin
    .from("membership_requests")
    .update({ status: "accepted", member_id: member.id, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", request.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, createdNewMember: !existingMember });
}
