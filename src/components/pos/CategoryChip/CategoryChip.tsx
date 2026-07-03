import type { ButtonHTMLAttributes } from "react";
import "./CategoryChip.css";

export interface CategoryChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Category label (e.g. Arabic name) */
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Optional image URL */
  image?: string;
  /** Selected state */
  selected?: boolean;
}

/**
 * Category filter chip for product categories.
 * RTL: icon and text flow correctly.
 */
export function CategoryChip({
  label,
  icon,
  image,
  selected = false,
  className = "",
  ...props
}: CategoryChipProps) {
  const classNames = [
    "pos-category-chip",
    selected && "pos-category-chip--selected",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classNames}
      aria-pressed={selected}
      {...props}
    >
      <span
        className={`pos-category-chip__icon ${icon || image ? "" : "pos-category-chip__icon--placeholder"}`.trim()}
        aria-hidden
      >
        {image ? <img src={image} alt={label} /> : icon}
      </span>
      <span className="pos-category-chip__label">{label}</span>
    </button>
  );
}
