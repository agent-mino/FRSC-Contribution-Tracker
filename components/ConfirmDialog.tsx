"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import LoadingButton from "./LoadingButton";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmingLabel = "Working…",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        ref={dialogRef}
      >
        <div className="confirm-dialog-icon" data-danger={danger}>
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p id="confirm-dialog-desc" className="muted">{description}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <LoadingButton
            type="button"
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
            loadingText={confirmingLabel}
            className={danger ? "danger" : ""}
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
