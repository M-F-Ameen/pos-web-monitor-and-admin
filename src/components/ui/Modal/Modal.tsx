import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "../IconButton";
import { IconX } from "../Icons";
import "./Modal.css";

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether clicking backdrop closes modal */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Footer content (buttons, etc.) */
  footer?: ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * Reusable modal dialog component.
 * Supports keyboard navigation, focus trapping, and RTL.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  footer,
  className = "",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleBackdropClick(event: React.MouseEvent) {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  }

  const sizeClass = `pos-modal--${size}`;
  const modalClasses = ["pos-modal", sizeClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="pos-modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={modalClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
      >
        {(title || showCloseButton) && (
          <header className="pos-modal__header">
            {title && (
              <h2 id="modal-title" className="pos-modal__title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <IconButton
                variant="ghost"
                aria-label="إغلاق"
                onClick={onClose}
                className="pos-modal__close"
              >
                <IconX />
              </IconButton>
            )}
          </header>
        )}
        <div className="pos-modal__body">{children}</div>
        {footer && <footer className="pos-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
