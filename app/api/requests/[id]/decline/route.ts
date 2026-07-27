import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: request, error: reqErr } = await admin
    .from("membership_requests")
    .select("status")
    .eq("id", params.id)
    .single();
  if (reqErr || !request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: `This request was already ${request.status}.` }, { status: 400 });
  }

  const { error } = await admin
    .from("membership_requests")
    .update({ status: "declined", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
