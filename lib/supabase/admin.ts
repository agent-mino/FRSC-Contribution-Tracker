import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER-SIDE ONLY. Never import this file from a Client Component.
// Bypasses Row Level Security entirely — every call site MUST first verify
// (via lib/supabase/server.ts, which respects RLS) that the caller is an
// admin, before using this client to write.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
