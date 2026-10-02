import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const apiUrl =
    env.VITE_API_URL ??
    env.API_URL ??
    (mode === "production" ? "http://100.96.72.20:5000" : "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl.replace(/\/$/, "")),
    },
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: { "/api": env.API_PROXY_TARGET || "http://127.0.0.1:5000" },
    },
  };
});
