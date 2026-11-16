import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const basePathRaw = process.env.VITE_BASE_PATH ?? "/";
const basePath = basePathRaw.endsWith("/") ? basePathRaw : `${basePathRaw}/`;

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Skibo",
        short_name: "Skibo",
        description: "Tasks, rewards, and a record of your effort.",
        theme_color: "#f5f3ec",
        background_color: "#f5f3ec",
        display: "standalone",
        scope: basePath,
        start_url: basePath,
        icons: [
          {
            src: `${basePath}icon-192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${basePath}icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
  },
});
