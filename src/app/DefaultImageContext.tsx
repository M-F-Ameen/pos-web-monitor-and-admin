import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_IMAGE } from "../assets/defaultImage";
import { settings as settingsService } from "../services/db";

interface DefaultImageContextType {
  defaultProductImage: string;
  setDefaultProductImage: (image: string) => void;
}

const DefaultImageContext = createContext<DefaultImageContextType>({
  defaultProductImage: DEFAULT_IMAGE,
  setDefaultProductImage: () => {},
});

export function DefaultImageProvider({ children }: { children: ReactNode }) {
  const [defaultProductImage, setDefaultProductImageState] =
    useState<string>(DEFAULT_IMAGE);

  const loadImage = useCallback(async () => {
    try {
      const s = await settingsService.get();
      setDefaultProductImageState(s.defaultProductImage || DEFAULT_IMAGE);
    } catch {
      // fallback to bundled default
    }
  }, []);

  useEffect(() => {
    void loadImage();
  }, [loadImage]);

  const setDefaultProductImage = useCallback((image: string) => {
    setDefaultProductImageState(image || DEFAULT_IMAGE);
  }, []);

  return (
    <DefaultImageContext.Provider
      value={{ defaultProductImage, setDefaultProductImage }}
    >
      {children}
    </DefaultImageContext.Provider>
  );
}

export function useDefaultImage(): string {
  return useContext(DefaultImageContext).defaultProductImage;
}

export function useDefaultImageContext(): DefaultImageContextType {
  return useContext(DefaultImageContext);
}
