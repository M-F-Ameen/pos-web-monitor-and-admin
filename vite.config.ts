import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Use relative paths so Electron can load from file://
  base: "./",

  build: {
    // Output to dist/ (loaded by electron/main.ts in production)
    outDir: "dist",
    emptyOutDir: true,
  },

  server: {
    // Fixed port for Electron dev mode
    port: 5173,
    strictPort: true,
  },
});
