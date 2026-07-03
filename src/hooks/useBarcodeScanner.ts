import { useEffect, useRef, useCallback } from "react";

export interface UseBarcodeOptions {
  /** Called when a complete barcode is detected */
  onBarcode: (barcode: string) => void;
  /** Maximum time between keystrokes to be considered part of the same barcode (ms) */
  maxGap?: number;
  /** Minimum barcode length to be considered valid */
  minLength?: number;
  /** Maximum barcode length */
  maxLength?: number;
  /** Whether the scanner is enabled */
  enabled?: boolean;
  /** Characters that mark the end of a barcode scan */
  endChars?: string[];
  /** Capture scanner input even when focus is inside an input/textarea */
  captureFromInputs?: boolean;
}

/**
 * Hook for detecting barcode scanner input.
 *
 * Barcode scanners typically work by simulating rapid keyboard input,
 * ending with Enter. This hook detects this pattern and extracts
 * the scanned barcode.
 *
 * @example
 * useBarcodeScanner({
 *   onBarcode: (barcode) => {
 *     const product = findProductByBarcode(barcode);
 *     if (product) addToCart(product);
 *   },
 *   enabled: !modalIsOpen
 * });
 */
export function useBarcodeScanner({
  onBarcode,
  maxGap = 50,
  minLength = 4,
  maxLength = 50,
  enabled = true,
  endChars = ["Enter"],
  captureFromInputs = false,
}: UseBarcodeOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // By default, ignore inputs so normal typing is unaffected.
      // POS can opt-in to capture scanner wedges while an input is focused.
      const target = event.target as HTMLElement;
      if (
        !captureFromInputs &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastKey = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // If too much time has passed, start fresh
      if (timeSinceLastKey > maxGap && bufferRef.current.length > 0) {
        resetBuffer();
      }

      // Check for end character
      if (endChars.includes(event.key)) {
        if (
          bufferRef.current.length >= minLength &&
          bufferRef.current.length <= maxLength
        ) {
          event.preventDefault();
          onBarcode(bufferRef.current);
        }
        resetBuffer();
        return;
      }

      // Add character to buffer
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        // Only add printable characters
        bufferRef.current += event.key;

        // Trim if too long
        if (bufferRef.current.length > maxLength) {
          bufferRef.current = bufferRef.current.slice(-maxLength);
        }
      }
    },
    [
      enabled,
      maxGap,
      minLength,
      maxLength,
      endChars,
      onBarcode,
      resetBuffer,
      captureFromInputs,
    ],
  );

  useEffect(() => {
    if (!enabled) {
      resetBuffer();
      return;
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown, resetBuffer]);

  return {
    /** Reset the current buffer */
    reset: resetBuffer,
    /** Current buffer contents (for debugging) */
    getBuffer: () => bufferRef.current,
  };
}

/**
 * Validates an EAN-13 barcode checksum.
 * Returns true if the barcode has a valid check digit.
 */
export function validateEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;

  const digits = barcode.split("").map(Number);
  const checkDigit = digits.pop()!;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  const calculatedCheck = (10 - (sum % 10)) % 10;
  return calculatedCheck === checkDigit;
}

/**
 * Validates a UPC-A barcode checksum.
 * Returns true if the barcode has a valid check digit.
 */
export function validateUPCA(barcode: string): boolean {
  if (!/^\d{12}$/.test(barcode)) return false;

  const digits = barcode.split("").map(Number);
  const checkDigit = digits.pop()!;

  let oddSum = 0;
  let evenSum = 0;

  for (let i = 0; i < 11; i++) {
    if (i % 2 === 0) {
      oddSum += digits[i];
    } else {
      evenSum += digits[i];
    }
  }

  const total = oddSum * 3 + evenSum;
  const calculatedCheck = (10 - (total % 10)) % 10;
  return calculatedCheck === checkDigit;
}
