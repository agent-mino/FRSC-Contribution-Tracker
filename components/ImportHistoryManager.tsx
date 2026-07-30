"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface ImportRow {
  id: string;
  bank_name: string;
  batch_label: string | null;
  month: number;
  year: number;
  source_filename: string;
  row_count: number;
  mismatch_count: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

interface Props {
  imports: ImportRow[];
  uploaderName: Record<string, string>;
}

export default function ImportHistoryManager({ imports, uploaderName }: Props) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<ImportRow | null>(null);
  const [affectedMemberCount, setAffectedMemberCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDeleteConfirm(imp: ImportRow) {
    setError(null);
    setPendingDelete(imp);
    setAffectedMemberCount(null);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/import/${imp.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load import details");
      setAffectedMemberCount(data.affectedMemberCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load import details");
      setAffectedMemberCount(0);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/import/${pendingDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete import");
      setPendingDelete(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete import");
    } finally {
      setDeleting(false);
    }
  }

  const label = pendingDelete
    ? `${pendingDelete.bank_name}${pendingDelete.batch_label ? " — " + pendingDelete.batch_label : ""} · ${MONTH_NAMES[pendingDelete.month]} ${pendingDelete.year}`
    : "";

  const description =
    affectedMemberCount === null
      ? "Checking what this will affect…"
      : `This will permanently remove ${label} from the ledger — ${affectedMemberCount} member${
          affectedMemberCount === 1 ? "" : "s"
        }' savings/loan/electronic/other entries for that month will be deleted from their record, and their balances recalculated. This can't be undone.`;

  return (
    <>
      {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}

      {imports.length === 0 ? (
        <p className="muted">No imports yet — go to Import schedule to upload your first file.</p>
      ) : (
        <table className="responsive">
          <thead>
            <tr>
              <th>Month</th>
              <th>Bank</th>
              <th>Batch</th>
              <th>File</th>
              <th className="num">Rows</th>
              <th className="num">Mismatches</th>
              <th>Uploaded by</th>
              <th>Uploaded at</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {imports.map((imp) => (
              <tr key={imp.id}>
                <td data-label="Month">{MONTH_NAMES[imp.month]} {imp.year}</td>
                <td data-label="Bank">{imp.bank_name}</td>
                <td data-label="Batch">{imp.batch_label || "—"}</td>
                <td
                  data-label="File"
                  style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {imp.source_filename}
                </td>
                <td className="num" data-label="Rows">{imp.row_count}</td>
                <td className="num" data-label="Mismatches">
                  {imp.mismatch_count > 0 ? (
                    <span className="badge warn">{imp.mismatch_count}</span>
                  ) : (
                    <span className="badge ok">0</span>
                  )}
                </td>
                <td data-label="Uploaded by">{imp.uploaded_by ? uploaderName[imp.uploaded_by] || "—" : "—"}</td>
                <td data-label="Uploaded at">
                  {new Date(imp.uploaded_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="secondary icon-only"
                    aria-label={`Delete ${MONTH_NAMES[imp.month]} ${imp.year} ${imp.bank_name} import`}
                    onClick={() => openDeleteConfirm(imp)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${label}?`}
        description={description}
        confirmLabel="Delete import"
        confirmingLabel="Deleting…"
        danger
        loading={deleting}
        confirmDisabled={loadingPreview || affectedMemberCount === null}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
    </>
  );
}
