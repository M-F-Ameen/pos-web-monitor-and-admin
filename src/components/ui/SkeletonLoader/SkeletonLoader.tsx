import "./SkeletonLoader.css";

export interface SkeletonLoaderProps {
  /** Height of the skeleton */
  height?: string | number;
  /** Width of the skeleton */
  width?: string | number;
  /** Border radius */
  borderRadius?: string | number;
  /** Number of skeleton lines to show */
  lines?: number;
  /** Space between lines */
  gap?: string;
  /** Whether to animate the skeleton */
  animate?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Skeleton loader component for content placeholders.
 * Shows animated placeholders while content is loading.
 */
export function SkeletonLoader({
  height = "1rem",
  width = "100%",
  borderRadius = "4px",
  lines = 1,
  gap = "8px",
  animate = true,
  className = "",
}: SkeletonLoaderProps) {
  const skeletonStyle = {
    height: typeof height === "number" ? `${height}px` : height,
    width: typeof width === "number" ? `${width}px` : width,
    borderRadius:
      typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
  };

  const containerStyle = lines > 1 ? { gap } : undefined;

  const skeletonClasses = [
    "skeleton-loader__item",
    animate && "skeleton-loader__item--animate",
  ]
    .filter(Boolean)
    .join(" ");

  const containerClasses = [
    "skeleton-loader",
    lines > 1 && "skeleton-loader--multiple",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (lines === 1) {
    return (
      <div
        className={skeletonClasses}
        style={skeletonStyle}
        aria-label="جاري التحميل..."
        role="status"
      />
    );
  }

  return (
    <div
      className={containerClasses}
      style={containerStyle}
      role="status"
      aria-label="جاري التحميل..."
    >
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={skeletonClasses}
          style={{
            ...skeletonStyle,
            // Vary width for last line to look more natural
            width: index === lines - 1 ? "75%" : skeletonStyle.width,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Predefined skeleton patterns for common use cases
 */
export const SkeletonPatterns = {
  /**
   * Table row skeleton
   */
  TableRow: ({ columns = 4 }: { columns?: number }) => (
    <tr className="skeleton-table-row">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="skeleton-table-cell">
          <SkeletonLoader height="16px" />
        </td>
      ))}
    </tr>
  ),

  /**
   * Product card skeleton
   */
  ProductCard: () => (
    <div className="skeleton-product-card">
      <SkeletonLoader height="160px" borderRadius="8px" />
      <div className="skeleton-product-card__content">
        <SkeletonLoader height="20px" width="80%" />
        <SkeletonLoader height="14px" width="60%" />
        <SkeletonLoader height="16px" width="40%" />
      </div>
    </div>
  ),

  /**
   * User profile skeleton
   */
  UserProfile: () => (
    <div className="skeleton-user-profile">
      <SkeletonLoader height="48px" width="48px" borderRadius="50%" />
      <div className="skeleton-user-profile__info">
        <SkeletonLoader height="16px" width="120px" />
        <SkeletonLoader height="12px" width="80px" />
      </div>
    </div>
  ),

  /**
   * Form field skeleton
   */
  FormField: () => (
    <div className="skeleton-form-field">
      <SkeletonLoader height="14px" width="80px" />
      <SkeletonLoader height="40px" borderRadius="8px" />
    </div>
  ),
};
