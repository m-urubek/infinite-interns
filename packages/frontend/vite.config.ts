import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: require.resolve("react") },
      { find: /^react-dom$/, replacement: require.resolve("react-dom") },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@langchain/langgraph-sdk"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:2024",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
