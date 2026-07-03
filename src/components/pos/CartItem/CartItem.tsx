import { useRef } from "react";
import { IconButton } from "../../ui/IconButton";
import { IconEdit, IconTrash } from "../../ui/Icons";
import "./CartItem.css";

function splitPriceParts(price: string): { currency: string; value: string } {
  const match = price.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return { currency: "", value: price.trim() };
  }

  const value = match[0];
  const currency = price.replace(value, "").trim();
  return { currency, value };
}

export interface CartItemProps {
  /** Product id (used for safe stock updates/returns) */
  productId?: string;
  /** Product name */
  name: string;
  /** Category or type label */
  category?: string;
  /** Rating text (e.g. "4.9(1.2k)") - reserved for future use */
  rating?: string;
  /** Size/modifier (e.g. "Medium") - reserved for future use */
  size?: string;
  /** Current price */
  price: string;
  /** Original price (strikethrough) - reserved for future use */
  originalPrice?: string;
  /** Quantity */
  quantity: number;
  /** Optional unit price increase (LE) */
  priceIncrease?: number;
  /** Image URL */
  image?: string;
  /** Update quantity */
  onQuantityChange?: (quantity: number) => void;
}

/**
 * Single line item in the order/cart panel.
 * RTL: image and content flow correctly.
 */
export function CartItem({
  name,
  category,
  rating: _rating,
  size: _size,
  price,
  originalPrice: _originalPrice,
  quantity,
  image,
  onQuantityChange,
}: CartItemProps) {
  const priceParts = splitPriceParts(price);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pos-cart-item" role="listitem">
      <div className="pos-cart-item__image-wrap">
        {image ? (
          <img
            src={image}
            alt=""
            className="pos-cart-item__image"
            loading="lazy"
          />
        ) : (
          <div className="pos-cart-item__image-placeholder" aria-hidden />
        )}
      </div>
      <div className="pos-cart-item__content">
        <h4 className="pos-cart-item__name">{name}</h4>
        {category && (
          <span className="pos-cart-item__category">{category}</span>
        )}

        <div className="pos-cart-item__pricing">
          <span className="pos-cart-item__price">
            {priceParts.currency && (
              <span className="pos-cart-item__price-currency">
                {priceParts.currency}
              </span>
            )}
            <span className="pos-cart-item__price-value">{priceParts.value}</span>
          </span>
        </div>
      </div>
      <div className="pos-cart-item__quantity">
        <input
          ref={quantityInputRef}
          type="number"
          min="0"
          step="1"
          value={quantity}
          onChange={(event) => {
            if (event.target.value === "") {
              return;
            }

            const nextValue = Number.parseInt(event.target.value, 10);
            if (Number.isNaN(nextValue)) {
              return;
            }

            onQuantityChange?.(Math.max(0, nextValue));
          }}
          className="pos-cart-item__qty-input"
          aria-label="الكمية"
        />
        <IconButton
          variant="default"
          className="pos-cart-item__edit-btn"
          aria-label="تعديل الكمية"
          onClick={() => {
            const quantityInput = quantityInputRef.current;
            if (!quantityInput) {
              return;
            }
            quantityInput.focus();
            quantityInput.select();
          }}
        >
          <IconEdit />
        </IconButton>
        <IconButton
          variant="danger"
          className="pos-cart-item__delete-btn"
          aria-label="حذف الصنف"
          onClick={() => onQuantityChange?.(0)}
        >
          <IconTrash />
        </IconButton>
      </div>
    </div>
  );
}
