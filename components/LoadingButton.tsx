"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
};

export default function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {loading ? loadingText ?? children : children}
    </button>
  );
}
