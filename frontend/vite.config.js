import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "cn": path.resolve(import.meta.dirname,"./src/lib/utils")
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    globals: true,
    environment: "node",
  },
});