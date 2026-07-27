import { createAdminClient } from "@/lib/supabase/admin";

type LoginMode = "invite" | "manual";

interface CreateMemberLoginArgs {
  memberId: string;
  memberName: string;
  email: string;
  mode: LoginMode;
  password?: string;
  origin: string; // used to build the invite email's redirect link
}

interface CreateMemberLoginResult {
  ok: boolean;
  error?: string;
}

// Creates (or invites) an auth login and links it to a member's profile.
// - "invite": sends the member an email with a link to set their own
//   password. Nobody types or shares a password. Requires Supabase's email
//   sending to be working for your project (Authentication > Email templates).
// - "manual": admin sets a temporary password directly, no email needed.
export async function createMemberLogin({
  memberId, memberName, email, mode, password, origin,
}: CreateMemberLoginArgs): Promise<CreateMemberLoginResult> {
  const admin = createAdminClient();

  const { data: alreadyLinked } = await admin
    .from("profiles")
    .select("id")
    .eq("member_id", memberId)
    .maybeSingle();
  if (alreadyLinked) {
    return { ok: false, error: "This member already has a linked login." };
  }

  let userId: string;

  if (mode === "invite") {
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (inviteErr || !invited?.user) {
      return { ok: false, error: inviteErr?.message || "Failed to send invite email" };
    }
    userId = invited.user.id;
  } else {
    if (!password || password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters" };
    }
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return { ok: false, error: createErr?.message || "Failed to create login" };
    }
    userId = created.user.id;
  }

  const { error: profileErr } = await admin.from("profiles").upsert(
    { id: userId, role: "member", member_id: memberId, full_name: memberName },
    { onConflict: "id" }
  );
  if (profileErr) return { ok: false, error: profileErr.message };

  return { ok: true };
}
