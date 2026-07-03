/**
 * POS UI Component Library - Barrel exports
 * Use these for clean imports when building new pages.
 */

export { Button } from "./ui/Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./ui/Button";

export { IconButton } from "./ui/IconButton";
export type { IconButtonProps, IconButtonVariant } from "./ui/IconButton";

export { Card } from "./ui/Card";
export type { CardProps } from "./ui/Card";

export { Input } from "./ui/Input";
export type { InputProps } from "./ui/Input";

export * from "./ui/Icons";

export { Tooltip } from "./ui/Tooltip";
export type { TooltipProps } from "./ui/Tooltip";

export { NavSidebar } from "./layout/NavSidebar";
export type { NavSidebarProps, NavItem, UserInfo } from "./layout/NavSidebar";

export { TopBar } from "./layout/TopBar";
export type { TopBarProps } from "./layout/TopBar";

export { OrderPanel } from "./layout/OrderPanel";
export type { OrderPanelProps, OrderType } from "./layout/OrderPanel";

export { CategoryChip } from "./pos/CategoryChip";
export type { CategoryChipProps } from "./pos/CategoryChip";

export { ProductCard } from "./pos/ProductCard";
export type { ProductCardProps } from "./pos/ProductCard";

export { CartItem } from "./pos/CartItem";
export type { CartItemProps } from "./pos/CartItem";

export { Modal } from "./ui/Modal";
export type { ModalProps } from "./ui/Modal";

export { LoadingSpinner } from "./ui/LoadingSpinner";
export type {
  LoadingSpinnerProps,
  LoadingSpinnerSize,
  LoadingSpinnerVariant,
} from "./ui/LoadingSpinner";

export { ErrorBoundary, ErrorBoundaryWrapper } from "./ui/ErrorBoundary";

export { OptimizedImage } from "./ui/OptimizedImage";
export type { OptimizedImageProps } from "./ui/OptimizedImage";

export { SkeletonLoader, SkeletonPatterns } from "./ui/SkeletonLoader";
export type { SkeletonLoaderProps } from "./ui/SkeletonLoader";

export { PaymentModal } from "./pos/PaymentModal";
export type { PaymentModalProps } from "./pos/PaymentModal";

export { CustomerModal } from "./pos/CustomerModal";
export type { CustomerModalProps } from "./pos/CustomerModal";

export { DiscountModal } from "./pos/DiscountModal";
export type { DiscountModalProps } from "./pos/DiscountModal";

export { ReceiptModal } from "./pos/ReceiptModal";
export type { ReceiptModalProps } from "./pos/ReceiptModal";
