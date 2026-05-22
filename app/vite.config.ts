import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // SPA fallback: all routes → index.html (so /market refresh works)
  server: { historyApiFallback: true } as never,
  preview: { port: 4173 },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react:  ["react", "react-dom"],
          router: ["react-router-dom"],
          wallet: ["@aptos-labs/wallet-adapter-react"],
        },
      },
    },
  },
});
