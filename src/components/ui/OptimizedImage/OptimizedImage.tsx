import { useState, useRef, useEffect, type ImgHTMLAttributes } from "react";
import { LoadingSpinner } from "../LoadingSpinner";
import { IconImage } from "../Icons";
import "./OptimizedImage.css";

export interface OptimizedImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "onLoad" | "onError"
> {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Fallback image URL if primary fails */
  fallbackSrc?: string;
  /** Whether to show loading spinner */
  showLoader?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Called when image loads successfully */
  onLoad?: () => void;
  /** Called when image fails to load */
  onError?: () => void;
  /** Aspect ratio for responsive images (width/height) */
  aspectRatio?: number;
  /** Whether to use lazy loading */
  lazy?: boolean;
}

type ImageState = "loading" | "loaded" | "error";

/**
 * Optimized image component with loading states, error handling, and lazy loading.
 * Provides better UX during image loading and fallback support.
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  showLoader = true,
  loadingComponent,
  errorComponent,
  onLoad,
  onError,
  aspectRatio,
  lazy = true,
  className = "",
  style,
  ...props
}: OptimizedImageProps) {
  const [imageState, setImageState] = useState<ImageState>("loading");
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isIntersecting, setIsIntersecting] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isIntersecting) return;

    const container = containerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsIntersecting(true);
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observerRef.current?.disconnect();
        }
      },
      {
        rootMargin: "50px", // Start loading 50px before image enters viewport
      },
    );

    observerRef.current.observe(container);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy, isIntersecting]);

  // Reset state when src changes
  useEffect(() => {
    setImageState("loading");
    setCurrentSrc(src);
  }, [src]);

  const handleLoad = () => {
    setImageState("loaded");
    onLoad?.();
  };

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setImageState("loading");
    } else {
      setImageState("error");
      onError?.();
    }
  };

  const containerStyle = aspectRatio
    ? {
        ...style,
        aspectRatio: aspectRatio.toString(),
      }
    : style;

  const containerClasses = [
    "optimized-image",
    `optimized-image--${imageState}`,
    aspectRatio && "optimized-image--aspect-ratio",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={containerClasses} style={containerStyle}>
      {isIntersecting && (
        <>
          <img
            src={currentSrc}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className="optimized-image__img"
            style={{
              opacity: imageState === "loaded" ? 1 : 0,
            }}
            {...props}
          />

          {/* Loading state */}
          {imageState === "loading" && showLoader && (
            <div className="optimized-image__overlay optimized-image__overlay--loading">
              {loadingComponent || (
                <LoadingSpinner size="md" variant="secondary" inline />
              )}
            </div>
          )}

          {/* Error state */}
          {imageState === "error" && (
            <div className="optimized-image__overlay optimized-image__overlay--error">
              {errorComponent || (
                <div className="optimized-image__error">
                  <IconImage />
                  <span className="optimized-image__error-text">
                    فشل في تحميل الصورة
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Lazy loading placeholder */}
      {!isIntersecting && (
        <div className="optimized-image__placeholder">
          {showLoader && (
            <LoadingSpinner size="sm" variant="secondary" inline />
          )}
        </div>
      )}
    </div>
  );
}
