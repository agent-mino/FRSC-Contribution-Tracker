import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ConfirmRow {
  coopAccountNo: string;
  name: string;
  bankAccountNo: string;
  savings: number;
  loan: number;
  electronic: number;
  other: number;
  totalMismatch?: boolean;
}
interface ConfirmSheet {
  sheetName: string;
  batchLabel: string | null;
  rows: ConfirmRow[];
}
interface ConfirmBody {
  bankName: string;
  filename: string;
  month: number;
  year: number;
  sheets: ConfirmSheet[];
  allowDuplicateMonthlyDeductions?: boolean;
}

const CATEGORIES = ["savings", "loan", "electronic", "other"] as const;
type Category = (typeof CATEGORIES)[number];

function normalizeAccount(value: string) {
  return value.trim().toUpperCase();
}

function cleanImportKeyPart(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function buildImportKey(args: {
  bankName: string;
  filename: string;
  month: number;
  year: number;
  batchLabel: string | null;
}) {
  return [
    cleanImportKeyPart(args.bankName),
    args.year,
    args.month,
    cleanImportKeyPart(args.batchLabel),
    cleanImportKeyPart(args.filename),
  ].join("|");
}

function nonZeroCategories(row: ConfirmRow): Category[] {
  return CATEGORIES.filter((category) => Number(row[category]) !== 0);
}

function rowTotal(row: ConfirmRow) {
  return CATEGORIES.reduce((sum, category) => sum + Number(row[category] ?? 0), 0);
}

export async function POST(req: NextRequest) {
  // Verify the caller is an admin using the RLS-respecting client first.
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

  const body = (await req.json()) as ConfirmBody;
  if (!body.sheets?.length || !body.month || !body.year) {
    return NextResponse.json({ error: "Missing month, year, or rows" }, { status: 400 });
  }
  const bankName = String(body.bankName || "").trim();
  const filename = String(body.filename || "").trim();
  if (!bankName || !filename) {
    return NextResponse.json({ error: "Bank name and filename are required" }, { status: 400 });
  }

  const submittedByAccount = new Map<
    string,
    Array<{ sheetName: string; batchLabel: string | null; importKey: string; row: ConfirmRow }>
  >();
  for (const sheet of body.sheets) {
    const importKey = buildImportKey({
      bankName,
      filename,
      month: body.month,
      year: body.year,
      batchLabel: sheet.batchLabel,
    });
    for (const row of sheet.rows) {
      if (rowTotal(row) === 0) continue;
      const key = normalizeAccount(row.coopAccountNo);
      if (!key) continue;
      const existing = submittedByAccount.get(key) ?? [];
      existing.push({ sheetName: sheet.sheetName, batchLabel: sheet.batchLabel, importKey, row });
      submittedByAccount.set(key, existing);
    }
  }
  const submittedDuplicates = Array.from(submittedByAccount.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([coopAccountNo, rows]) => ({
      coopAccountNo,
      name: rows[0]?.row.name ?? "",
      rows: rows.map((r) => ({
        sheetName: r.sheetName,
        batchLabel: r.batchLabel,
        total: rowTotal(r.row),
      })),
    }));
  const sameImportDuplicates = submittedDuplicates.filter((duplicate) => {
    const rows = submittedByAccount.get(duplicate.coopAccountNo) ?? [];
    return rows.some((row, _index, allRows) =>
      allRows.filter((other) => other.importKey === row.importKey).length > 1
    );
  });
  if (sameImportDuplicates.length > 0) {
    return NextResponse.json(
      {
        error: "This upload repeats the same cooperative account inside the same sheet/batch. Fix the spreadsheet first so the app knows which row is authoritative.",
        duplicateKind: "same_import",
        duplicates: sameImportDuplicates,
      },
      { status: 409 }
    );
  }
  if (submittedDuplicates.length > 0 && !body.allowDuplicateMonthlyDeductions) {
    return NextResponse.json(
      {
        error: "This upload contains the same cooperative account number in more than one sheet/batch. Review it before importing to avoid double-counting.",
        duplicateKind: "submitted",
        duplicates: submittedDuplicates,
      },
      { status: 409 }
    );
  }

  // From here on, use the admin (service-role) client — the admin check above
  // is what authorizes bypassing RLS for this bulk write.
  const admin = createAdminClient();

  const importKeys = body.sheets.map((sheet) =>
    buildImportKey({
      bankName,
      filename,
      month: body.month,
      year: body.year,
      batchLabel: sheet.batchLabel,
    })
  );
  const { data: existingImports } = await admin
    .from("monthly_imports")
    .select("id, import_key")
    .in("import_key", importKeys);
  const importIdByKey = new Map((existingImports ?? []).map((row) => [row.import_key, row.id]));

  const accountNumbers = Array.from(submittedByAccount.keys());
  const { data: existingMembers } = accountNumbers.length
    ? await admin
        .from("members")
        .select("id, coop_account_no, name")
        .in("coop_account_no", accountNumbers)
    : { data: [] as { id: string; coop_account_no: string; name: string }[] };
  const memberByAccount = new Map(
    (existingMembers ?? []).map((member) => [normalizeAccount(member.coop_account_no), member])
  );

  const memberIds = (existingMembers ?? []).map((member) => member.id);
  const { data: existingTransactions } = memberIds.length
    ? await admin
        .from("deduction_transactions")
        .select("member_id, import_id, category, amount, source_bank_name, source_sheet_name")
        .eq("year", body.year)
        .eq("month", body.month)
        .in("member_id", memberIds)
    : { data: [] as Array<{
        member_id: string;
        import_id: string | null;
        category: Category;
        amount: number | string;
        source_bank_name: string | null;
        source_sheet_name: string | null;
      }> };

  const sameUploadImportIds = new Set(Array.from(importIdByKey.values()));
  const duplicateMonthlyDeductions: Array<{
    coopAccountNo: string;
    name: string;
    categories: Category[];
    existingSources: string[];
  }> = [];

  for (const [coopAccountNo, submittedRows] of submittedByAccount) {
    const member = memberByAccount.get(coopAccountNo);
    if (!member) continue;
    const submittedCategories = new Set<Category>();
    submittedRows.forEach(({ row }) => nonZeroCategories(row).forEach((category) => submittedCategories.add(category)));
    const conflicting = (existingTransactions ?? []).filter(
      (txn) =>
        txn.member_id === member.id &&
        !sameUploadImportIds.has(txn.import_id ?? "") &&
        Number(txn.amount) !== 0 &&
        submittedCategories.has(txn.category)
    );
    if (conflicting.length > 0) {
      duplicateMonthlyDeductions.push({
        coopAccountNo,
        name: member.name,
        categories: Array.from(new Set(conflicting.map((txn) => txn.category))),
        existingSources: Array.from(
          new Set(
            conflicting.map((txn) =>
              [txn.source_bank_name, txn.source_sheet_name].filter(Boolean).join(" / ") || "existing import"
            )
          )
        ),
      });
    }
  }

  if (duplicateMonthlyDeductions.length > 0 && !body.allowDuplicateMonthlyDeductions) {
    return NextResponse.json(
      {
        error: `Some members already have deductions for ${body.month}/${body.year}. Importing this file would add another deduction for the same month.`,
        duplicateKind: "existing_month",
        duplicates: duplicateMonthlyDeductions,
      },
      { status: 409 }
    );
  }

  let totalRowsImported = 0;
  let importsCreated = 0;
  let importsUpdated = 0;

  for (const [sheetIndex, sheet] of body.sheets.entries()) {
    if (sheet.rows.length === 0) continue;

    const sourceTotalCount = sheet.rows.length;
    const mismatchCount = sheet.rows.filter((r) => r.totalMismatch).length;
    const importKey = importKeys[sheetIndex];
    const hadExistingImport = importIdByKey.has(importKey);
    const { data: importRow, error: importErr } = await admin
      .from("monthly_imports")
      .upsert({
        import_key: importKey,
        bank_name: bankName,
        batch_label: sheet.batchLabel,
        month: body.month,
        year: body.year,
        source_filename: filename,
        row_count: sourceTotalCount,
        mismatch_count: mismatchCount,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      }, { onConflict: "import_key" })
      .select()
      .single();

    if (importErr || !importRow) {
      return NextResponse.json(
        { error: `Failed to record import for sheet "${sheet.sheetName}": ${importErr?.message}` },
        { status: 500 }
      );
    }
    if (hadExistingImport) importsUpdated += 1;
    else importsCreated += 1;

    for (const row of sheet.rows) {
      // Upsert member by coop_account_no (the durable identity across banks/months)
      const { data: member, error: memberErr } = await admin
        .from("members")
        .upsert(
          {
            coop_account_no: row.coopAccountNo,
            name: row.name,
            bank_name: bankName,
            bank_account_no: row.bankAccountNo,
          },
          { onConflict: "coop_account_no" }
        )
        .select()
        .single();

      if (memberErr || !member) {
        return NextResponse.json(
          { error: `Failed to upsert member ${row.coopAccountNo}: ${memberErr?.message}` },
          { status: 500 }
        );
      }
      const categories: Array<{ category: string; amount: number }> = [
        { category: "savings", amount: row.savings },
        { category: "loan", amount: row.loan },
        { category: "electronic", amount: row.electronic },
        { category: "other", amount: row.other },
      ];

      const { error: txnErr } = await admin.from("deduction_transactions").upsert(
        categories.map((c) => ({
          member_id: member.id,
          import_id: importRow.id,
          month: body.month,
          year: body.year,
          category: c.category,
          amount: c.amount,
          source_name: row.name,
          source_coop_account_no: row.coopAccountNo,
          source_bank_name: bankName,
          source_bank_account_no: row.bankAccountNo,
          source_sheet_name: sheet.sheetName,
          created_by: user.id,
        })),
        { onConflict: "member_id,import_id,category" }
      );

      if (txnErr) {
        return NextResponse.json(
          { error: `Failed to record deductions for ${row.coopAccountNo}: ${txnErr.message}` },
          { status: 500 }
        );
      }

      totalRowsImported += 1;
    }
  }

  return NextResponse.json({ success: true, rowsImported: totalRowsImported, importsCreated, importsUpdated });
}
