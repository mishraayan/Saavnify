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

      /**
       🔥 IMPORTANT!
       Use injectManifest so we can write our own
       service worker (sw-push.js) → push notifications
      */
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw-push.js",

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

      /**
       ⚠️ DO NOT USE workbox when using injectManifest.
       All caching rules go inside sw-push.js
      */
      devOptions: {
        enabled: true, // allow PWA during dev
        type: "module",
      },
    }),
  ],

  /**
   Optional but recommended.
   Ensures assets load correctly when deployed to subpath
  */
  server: {
    port: 5173,
    open: true,
  },
});
