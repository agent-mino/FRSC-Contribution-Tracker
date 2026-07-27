"use client";

import { useRef, useState } from "react";

interface PreviewRow {
  name: string;
  coopAccountNo: string;
  bankAccountNo: string;
  savings: number;
  loan: number;
  electronic: number;
  other: number;
  sourceTotal: number | null;
  computedTotal: number;
  totalMismatch: boolean;
  isNewMember: boolean;
  duplicateInUpload: boolean;
}
interface PreviewSheet {
  sheetName: string;
  batchLabel: string | null;
  mismatchCount: number;
  rows: PreviewRow[];
}
interface Preview {
  bankName: string;
  filename: string;
  totalRows: number;
  totalMismatches: number;
  newMemberCount: number;
  duplicateAccountCount: number;
  sheets: PreviewSheet[];
}

interface DuplicateImportError {
  message: string;
  duplicates: Array<{
    coopAccountNo: string;
    name: string;
    categories?: string[];
    existingSources?: string[];
    rows?: Array<{ sheetName: string; batchLabel: string | null; total: number }>;
  }>;
}

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function naira(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

export default function ImportWizard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [bankName, setBankName] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<DuplicateImportError | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    setDuplicateError(null);
    setPreview(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse file");
      setPreview(data);
      setBankName(data.bankName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading that file");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(allowDuplicateMonthlyDeductions = false) {
    if (!preview) return;
    setConfirming(true);
    setError(null);
    setDuplicateError(null);
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName,
          filename: preview.filename,
          month,
          year,
          allowDuplicateMonthlyDeductions,
          sheets: preview.sheets.map((s) => ({
            sheetName: s.sheetName,
            batchLabel: s.batchLabel,
            rows: s.rows,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data.duplicates)) {
          setDuplicateError({ message: data.error || "Duplicate deductions found.", duplicates: data.duplicates });
          return;
        }
        throw new Error(data.error || "Import failed");
      }
      const importSummary = data.importsUpdated
        ? `${data.importsUpdated} existing batch${data.importsUpdated === 1 ? "" : "es"} updated`
        : `${data.importsCreated} new batch${data.importsCreated === 1 ? "" : "es"} created`;
      setSuccess(`Imported ${data.rowsImported} member deductions for ${MONTH_OPTIONS[month - 1]} ${year}; ${importSummary}.`);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div>
      {!preview && (
        <div
          className={`dropzone ${dragActive ? "active" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <p style={{ margin: 0, fontWeight: 600, color: "var(--forest-dark)" }}>
            {loading ? "Reading file…" : "Drop this month's bank deduction schedule here"}
          </p>
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            or click to choose a .xlsx file — works with UBA, FCMB, or any bank's schedule
          </p>
        </div>
      )}

      {error && (
        <p className="error-text" style={{ marginTop: 12 }}>{error}</p>
      )}
      {success && (
        <div className="card" style={{ borderLeft: "4px solid var(--gold)", marginTop: 12 }}>
          <p style={{ margin: 0 }}>{success}</p>
        </div>
      )}

      {preview && (
        <div style={{ marginTop: 16 }}>
          <div className="stat-row">
            <div className="stat">
              <div className="label">Bank</div>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div className="stat">
              <div className="label">Month</div>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ marginTop: 4 }}>
                {MONTH_OPTIONS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="stat">
              <div className="label">Year</div>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ marginTop: 4 }}
              />
            </div>
            <div className="stat">
              <div className="label">Rows found</div>
              <div className="value">{preview.totalRows}</div>
            </div>
            <div className="stat">
              <div className="label">New members</div>
              <div className="value">{preview.newMemberCount}</div>
            </div>
          </div>

          {preview.totalMismatches > 0 && (
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              <span className="badge warn">{preview.totalMismatches} total mismatch{preview.totalMismatches === 1 ? "" : "es"}</span>
              {" "}— the file&apos;s own TOTAL column disagrees with its 4 category columns on these rows.
              The app always recomputes from the 4 categories and ignores the file&apos;s total, so this is informational only.
            </p>
          )}

          {preview.duplicateAccountCount > 0 && (
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              <span className="badge warn">{preview.duplicateAccountCount} duplicate account{preview.duplicateAccountCount === 1 ? "" : "s"}</span>
              {" "}— the same cooperative account appears more than once in this upload.
              Confirm will stop unless you explicitly import duplicates.
            </p>
          )}

          {duplicateError && (
            <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginTop: 12 }}>
              <h2>Duplicate deduction check</h2>
              <p className="error-text" style={{ marginTop: -8 }}>{duplicateError.message}</p>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Coop A/C</th>
                      <th>Name</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateError.duplicates.slice(0, 12).map((dup) => (
                      <tr key={dup.coopAccountNo}>
                        <td>{dup.coopAccountNo}</td>
                        <td>{dup.name}</td>
                        <td>
                          {dup.categories?.length
                            ? `${dup.categories.join(", ")} already recorded from ${dup.existingSources?.join(", ") || "another import"}`
                            : dup.rows?.map((row) => `${row.sheetName}${row.batchLabel ? ` / ${row.batchLabel}` : ""}: ${naira(row.total)}`).join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {duplicateError.duplicates.length > 12 && (
                <p className="muted" style={{ fontSize: 12 }}>
                  Showing 12 of {duplicateError.duplicates.length} duplicate rows.
                </p>
              )}
              <button
                className="secondary"
                onClick={() => handleConfirm(true)}
                disabled={confirming}
                style={{ marginTop: 12 }}
              >
                Import anyway and add duplicates
              </button>
            </div>
          )}

          {preview.sheets.map((sheet) => (
            <div key={sheet.sheetName} className="card">
              <h2>
                {sheet.sheetName}
                {sheet.batchLabel ? ` — ${sheet.batchLabel}` : ""}
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Coop A/C</th>
                      <th>Name</th>
                      <th className="num">Savings</th>
                      <th className="num">Loan</th>
                      <th className="num">Electronic</th>
                      <th className="num">Other</th>
                      <th className="num">Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row, index) => (
                      <tr key={`${row.coopAccountNo}-${index}`}>
                        <td>{row.coopAccountNo}</td>
                        <td>{row.name}</td>
                        <td className="num">{naira(row.savings)}</td>
                        <td className="num">{naira(row.loan)}</td>
                        <td className="num">{naira(row.electronic)}</td>
                        <td className="num">{naira(row.other)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{naira(row.computedTotal)}</td>
                        <td>
                          {row.isNewMember && <span className="badge ok">New member</span>}
                          {row.totalMismatch && <span className="badge warn" style={{ marginLeft: 4 }}>Total differs</span>}
                          {row.duplicateInUpload && <span className="badge warn" style={{ marginLeft: 4 }}>Duplicate</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => handleConfirm(false)} disabled={confirming}>
              {confirming ? "Importing…" : `Confirm import (${preview.totalRows} rows)`}
            </button>
            <button
              className="secondary"
              onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
              disabled={confirming}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
