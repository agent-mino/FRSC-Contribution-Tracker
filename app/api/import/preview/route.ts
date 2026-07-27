import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseWorkbook } from "@/lib/parseSchedule";

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

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseWorkbook(file.name, buffer);
  } catch (e) {
    return NextResponse.json(
      { error: "Could not read this file. Is it a valid .xlsx deduction schedule?" },
      { status: 400 }
    );
  }

  if (parsed.sheets.length === 0) {
    return NextResponse.json(
      { error: "No recognizable data found. Expected columns like NAME and COOP. A/C weren't found in the first 10 rows of any sheet." },
      { status: 400 }
    );
  }

  // Flag which coop account numbers are already known members
  const allCoopAccounts = Array.from(
    new Set(parsed.sheets.flatMap((s) => s.rows.map((r) => r.coopAccountNo)))
  );
  const { data: existingMembers } = await supabase
    .from("members")
    .select("coop_account_no")
    .in("coop_account_no", allCoopAccounts);
  const knownSet = new Set((existingMembers ?? []).map((m) => m.coop_account_no));
  const accountCounts = new Map<string, number>();
  parsed.sheets.forEach((sheet) => {
    sheet.rows.forEach((row) => {
      const key = row.coopAccountNo.trim().toUpperCase();
      accountCounts.set(key, (accountCounts.get(key) ?? 0) + 1);
    });
  });

  const sheets = parsed.sheets.map((sheet) => ({
    sheetName: sheet.sheetName,
    batchLabel: sheet.batchLabel,
    mismatchCount: sheet.mismatchCount,
    rows: sheet.rows.map((r) => ({
      ...r,
      isNewMember: !knownSet.has(r.coopAccountNo),
      duplicateInUpload: (accountCounts.get(r.coopAccountNo.trim().toUpperCase()) ?? 0) > 1,
    })),
  }));

  const newMemberCount = sheets.reduce(
    (n, s) => n + s.rows.filter((r) => r.isNewMember).length,
    0
  );
  const duplicateAccountCount = Array.from(accountCounts.values()).filter((count) => count > 1).length;

  return NextResponse.json({
    bankName: parsed.bankName,
    filename: file.name,
    totalRows: parsed.totalRows,
    totalMismatches: parsed.totalMismatches,
    newMemberCount,
    duplicateAccountCount,
    sheets,
  });
}
