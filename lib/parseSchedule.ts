// Parses a bank deduction-schedule Excel file into canonical rows, regardless
// of which bank's header wording is used (UBA: "M/SAVINGS", FCMB: "MONTHLY
// SAVING", etc). Validated against real UBA and FCMB May 2026 files.
//
// A workbook may contain multiple sheets (UBA ships "BATCH I" / "BATCH II"
// as separate sheets in one file) — every sheet is parsed and returned.

import * as XLSX from "xlsx";

export type DeductionCategory = "savings" | "loan" | "electronic" | "other";

export interface ParsedRow {
  sNo: number | null;
  name: string;
  coopAccountNo: string;
  bankAccountNo: string;
  savings: number;
  loan: number;
  electronic: number;
  other: number;
  sourceTotal: number | null; // TOTAL DEDT. as printed in the file, may be blank/wrong
  computedTotal: number;      // savings + loan + electronic + other — always trusted
  totalMismatch: boolean;     // true if sourceTotal is present and != computedTotal
}

export interface ParsedSheet {
  sheetName: string;
  batchLabel: string | null;  // "BATCH I" / "BATCH II" extracted from sheet name or title rows, else null
  headerRowIndex: number;
  rows: ParsedRow[];
  mismatchCount: number;
}

export interface ParsedWorkbook {
  bankName: string;           // inferred from filename, can be overridden by the uploader
  sheets: ParsedSheet[];
  totalRows: number;
  totalMismatches: number;
}

// Column header aliases -> canonical field. Matched case-insensitively after
// stripping punctuation/whitespace, so "M/SAVINGS", "M SAVINGS", "MONTHLY
// SAVING" all resolve the same way.
const HEADER_ALIASES: Record<string, keyof typeof FIELD_MAP> = {} as never;

const FIELD_MAP = {
  sNo: ["SNO", "S/NO", "SNUMBER", "SERIALNO"],
  name: ["NAME"],
  coopAccountNo: ["COOPAC", "COOPACCOUNT", "ACSACCOUNTNO", "COOPACCOUNTNO"],
  bankAccountNo: ["UBAAC", "UBAACCOUNT", "BANKACCOUNTNO", "ACCOUNTNO", "UBAACOUNT"],
  savings: ["MSAVINGS", "MONTHLYSAVING", "MONTHLYSAVINGS", "SAVINGS"],
  loan: ["LOANDED", "LOANDEDUCTION", "LOAN"],
  electronic: ["PZDED", "ELECTRONICDEDUCTION", "PZDEDUCTION", "ELECTRONIC"],
  other: ["LANDOTHER", "OTHERDEDUCTION", "OTHER"],
  total: ["TOTALDEDT", "TOTALDEDUCTION", "TOTAL"],
} as const;

type CanonicalField = keyof typeof FIELD_MAP;

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // strip spaces, slashes, dots, parens
}

function matchField(normalizedHeader: string): CanonicalField | null {
  for (const field of Object.keys(FIELD_MAP) as CanonicalField[]) {
    if (FIELD_MAP[field].includes(normalizedHeader as never)) return field;
  }
  return null;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toNumber(v: unknown): number {
  return toNumberOrNull(v) ?? 0;
}

// Scans the first `maxScanRows` rows of a sheet looking for the header row:
// the row that contains both a NAME-like column and an account-number-like
// column. Bank files have 3-4 title/letterhead rows above the real header,
// and the count of those title rows differs by bank and even by sheet.
function findHeaderRow(rows: unknown[][], maxScanRows = 10): number | null {
  const scanLimit = Math.min(maxScanRows, rows.length);
  for (let i = 0; i < scanLimit; i++) {
    const normalized = (rows[i] ?? []).map(normalizeHeader);
    const hasName = normalized.some((c) => c === "NAME");
    const hasAccount = normalized.some(
      (c) => matchField(c) === "coopAccountNo" || matchField(c) === "bankAccountNo"
    );
    if (hasName && hasAccount) return i;
  }
  return null;
}

function extractBatchLabel(sheetName: string, titleRows: unknown[][]): string | null {
  const fromSheetName = sheetName.match(/BATCH\s*\(?\s*([IVX]+)\s*\)?/i);
  if (fromSheetName) return `BATCH ${fromSheetName[1].toUpperCase()}`;
  for (const row of titleRows) {
    const text = row.map((c) => String(c ?? "")).join(" ");
    const m = text.match(/BATCH\s*\(?\s*([IVX]+)\s*\)?/i);
    if (m) return `BATCH ${m[1].toUpperCase()}`;
  }
  return null;
}

export function parseSheet(sheetName: string, rows: unknown[][]): ParsedSheet | null {
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex === null) return null;

  const headerRow = rows[headerRowIndex].map(normalizeHeader);
  const colIndex: Partial<Record<CanonicalField, number>> = {};
  headerRow.forEach((h, idx) => {
    const field = matchField(h);
    if (field && colIndex[field] === undefined) colIndex[field] = idx;
  });

  const batchLabel = extractBatchLabel(sheetName, rows.slice(0, headerRowIndex));

  const parsedRows: ParsedRow[] = [];
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = String(row[colIndex.name ?? -1] ?? "").trim();
    const coopAccountNo = String(row[colIndex.coopAccountNo ?? -1] ?? "").trim();

    // Skip blank / footer / subtotal rows: a real data row always has a name
    // AND a coop account number.
    if (!name || !coopAccountNo) continue;

    const savings = toNumber(row[colIndex.savings ?? -1]);
    const loan = toNumber(row[colIndex.loan ?? -1]);
    const electronic = toNumber(row[colIndex.electronic ?? -1]);
    const other = toNumber(row[colIndex.other ?? -1]);
    const computedTotal = savings + loan + electronic + other;
    const sourceTotal = toNumberOrNull(row[colIndex.total ?? -1]);

    parsedRows.push({
      sNo: toNumberOrNull(row[colIndex.sNo ?? -1]),
      name,
      coopAccountNo,
      bankAccountNo: String(row[colIndex.bankAccountNo ?? -1] ?? "").trim(),
      savings,
      loan,
      electronic,
      other,
      sourceTotal,
      computedTotal,
      totalMismatch: sourceTotal !== null && sourceTotal !== computedTotal,
    });
  }

  return {
    sheetName,
    batchLabel,
    headerRowIndex,
    rows: parsedRows,
    mismatchCount: parsedRows.filter((r) => r.totalMismatch).length,
  };
}

function inferBankName(filename: string): string {
  const upper = filename.toUpperCase();
  if (upper.includes("UBA")) return "UBA";
  if (upper.includes("FCMB")) return "FCMB";
  if (upper.includes("GTB") || upper.includes("GTBANK")) return "GTBank";
  if (upper.includes("ZENITH")) return "Zenith";
  if (upper.includes("ACCESS")) return "Access";
  // Fall back to the first token of the filename before "DEDUCTION"
  const m = filename.match(/([A-Z]{2,10})[_\s-]*DEDUCTION/i);
  return m ? m[1].toUpperCase() : "UNKNOWN";
}

export function parseWorkbook(filename: string, buffer: ArrayBuffer | Buffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: buffer instanceof Buffer ? "buffer" : "array" });
  const sheets: ParsedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      blankrows: false,
    });
    const parsed = parseSheet(sheetName, rows);
    if (parsed && parsed.rows.length > 0) sheets.push(parsed);
  }

  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
  const totalMismatches = sheets.reduce((sum, s) => sum + s.mismatchCount, 0);

  return {
    bankName: inferBankName(filename),
    sheets,
    totalRows,
    totalMismatches,
  };
}

// Flattens a parsed workbook into (member, category, amount) triples ready
// to upsert into deduction_transactions. Zero-amount categories are still
// included (as 0) so re-imports correctly zero-out a category that dropped
// off this month's schedule for a member.
export function toTransactionRows(
  parsed: ParsedWorkbook
): Array<{
  coopAccountNo: string;
  name: string;
  bankAccountNo: string;
  savings: number;
  loan: number;
  electronic: number;
  other: number;
}> {
  const out: ReturnType<typeof toTransactionRows> = [];
  for (const sheet of parsed.sheets) {
    for (const row of sheet.rows) {
      out.push({
        coopAccountNo: row.coopAccountNo,
        name: row.name,
        bankAccountNo: row.bankAccountNo,
        savings: row.savings,
        loan: row.loan,
        electronic: row.electronic,
        other: row.other,
      });
    }
  }
  return out;
}
