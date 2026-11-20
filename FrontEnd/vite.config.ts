import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VITE_API_PROXY;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": apiTarget ?? "http://localhost:8000" },
  },
  test: { environment: "node" },
});
