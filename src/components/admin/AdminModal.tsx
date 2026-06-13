"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

/**
 * Portal-based modal. Renders into document.body so the fixed overlay always
 * covers the full viewport, regardless of any ancestor that creates a
 * containing block (transform, filter, backdrop-blur, etc.).
 */
export default function AdminModal({ open, onClose, children, className = "" }: AdminModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className={`admin-modal ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
