import { OptimizedImage } from "../../ui/OptimizedImage";
import { useDefaultImage } from "../../../app/DefaultImageContext";
import "./ProductCard.css";

function splitPriceParts(price: string): { currency: string; value: string } {
  const match = price.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return { currency: "", value: price.trim() };
  }

  const value = match[0];
  const currency = price.replace(value, "").trim();
  return { currency, value };
}

export interface ProductCardProps {
  /** Product name */
  name: string;
  /** Short description */
  description?: string;
  /** Current price (display string) */
  price: string;
  /** Original/old price (optional, shown strikethrough) */
  originalPrice?: string;
  /** Image URL */
  image?: string;
  /** Add to cart callback */
  onAddToCart?: () => void;
}

/**
 * Product card for grid display.
 * Clicking the card adds the item to cart when callback is provided.
 */
export function ProductCard({
  name,
  description,
  price,
  originalPrice,
  image,
  onAddToCart,
}: ProductCardProps) {
  const defaultImage = useDefaultImage();
  const imageSrc = image || defaultImage;
  const isClickable = typeof onAddToCart === "function";
  const priceParts = splitPriceParts(price);

  return (
    <article
      className={`pos-product-card${isClickable ? " pos-product-card--clickable" : ""}`}
      onClick={onAddToCart}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onAddToCart();
              }
            }
          : undefined
      }
    >
      <div className="pos-product-card__image-wrap">
        {originalPrice && <span className="pos-product-card__badge">عرض</span>}
        {isClickable && (
          <span className="pos-product-card__add-btn" aria-hidden="true">
            +
          </span>
        )}
        <div className="pos-product-card__sheen" aria-hidden="true" />
        <OptimizedImage
          src={imageSrc}
          alt={name}
          fallbackSrc={defaultImage}
          aspectRatio={1}
          className="pos-product-card__image"
        />
        <div className="pos-product-card__body">
          <h3 className="pos-product-card__name">{name}</h3>
          {description && (
            <p className="pos-product-card__description">{description}</p>
          )}
          <div className="pos-product-card__pricing">
            <span className="pos-product-card__price">
              {priceParts.currency && (
                <span className="pos-product-card__price-currency">
                  {priceParts.currency}
                </span>
              )}
              <span className="pos-product-card__price-value">
                {priceParts.value}
              </span>
            </span>
            {originalPrice && (
              <span className="pos-product-card__original-price">
                {originalPrice}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
