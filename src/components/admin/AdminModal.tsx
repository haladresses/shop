"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  /** Header title. The header (with a close button) is always rendered. */
  title?: React.ReactNode;
  /** Optional footer content (action buttons). Omit when there are no actions. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Hide the header close (X) button. */
  hideClose?: boolean;
  /** Extra classes for the scrollable body region. */
  bodyClassName?: string;
};

/**
 * Portal-based modal. Renders into document.body so the fixed overlay always
 * covers the full viewport, regardless of any ancestor that creates a
 * containing block (transform, filter, backdrop-blur, etc.).
 *
 * Structure (project rule): a fixed header is always shown, the body is the
 * single scrollable region, and the footer is only rendered when action
 * buttons are provided via the `footer` prop.
 */
export default function AdminModal({
  open,
  onClose,
  title,
  footer,
  children,
  className = "",
  hideClose = false,
  bodyClassName = "",
}: AdminModalProps) {
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
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">{title}</h3>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center flex-shrink-0"
            >
              <LuX size={18} />
            </button>
          )}
        </div>

        <div className={`admin-modal-body ${bodyClassName}`}>{children}</div>

        {footer && <div className="admin-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
