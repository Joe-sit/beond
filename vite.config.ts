import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vite.dev/config/
// HTTPS is required for LIFF (LINE Login) — endpoint URLs must be https,
// so the dev server runs on https://localhost:5199 with a self-signed cert.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), basicSsl()],
    server: {
      port: 5199,
      // SEC Open Data API proxy: keeps the subscription key server-side
      // (SEC_API_KEY has no VITE_ prefix, so it never reaches the bundle).
      proxy: {
        "/sec-api": {
          target: "https://api.sec.or.th",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/sec-api/, ""),
          headers: {
            "Ocp-Apim-Subscription-Key": env.SEC_API_KEY ?? "",
          },
        },
      },
    },
  };
});
