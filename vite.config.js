import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "autoUpdate",

      // ✅ Use our own service worker with injectManifest
      strategies: "injectManifest",

      // ✅ Tell Workbox exactly where the source SW is
      injectManifest: {
        swSrc: "sw.js",   // source at project root
        swDest: "sw.mjs", // output in dist/sw.mjs (different name)
      },

      manifest: {
        name: "Saavnify ULTRA",
        short_name: "Saavnify",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          {
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "apple-touch-icon",
          },
        ],
      },

      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],

  server: {
    port: 5173,
    open: true,
  },
});
