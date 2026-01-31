// vite.config.ts
import { defineConfig } from "file:///F:/whatsapp/Final-Project-Wp/wpcode/node_modules/vite/dist/node/index.js";
import react from "file:///F:/whatsapp/Final-Project-Wp/wpcode/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///F:/whatsapp/Final-Project-Wp/wpcode/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///F:/whatsapp/Final-Project-Wp/wpcode/node_modules/autoprefixer/lib/autoprefixer.js";
var vite_config_default = defineConfig({
  envPrefix: ["VITE_", "BRIDGE_DOMAIN"],
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer()
      ]
    }
  },
  server: {
    port: 3e3,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false
      },
      "/uploads": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false
      }
    },
    host: "0.0.0.0",
    // Allow network access
    allowedHosts: true,
    // Allow ngrok/tunnel domains
    hmr: {
      // clientPort: 443, // Disabled for local dev (Enable only for Ngrok/HTTPS tunneling)
    },
    watch: {
      usePolling: true
      // Docker/Windows sometimes needs this for file changes
    }
  },
  build: {
    chunkSizeWarningLimit: 1e3
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFx3aGF0c2FwcFxcXFxGaW5hbC1Qcm9qZWN0LVdwXFxcXHdwY29kZVxcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkY6XFxcXHdoYXRzYXBwXFxcXEZpbmFsLVByb2plY3QtV3BcXFxcd3Bjb2RlXFxcXGNsaWVudFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRjovd2hhdHNhcHAvRmluYWwtUHJvamVjdC1XcC93cGNvZGUvY2xpZW50L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAndGFpbHdpbmRjc3MnXHJcbmltcG9ydCBhdXRvcHJlZml4ZXIgZnJvbSAnYXV0b3ByZWZpeGVyJ1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBlbnZQcmVmaXg6IFsnVklURV8nLCAnQlJJREdFX0RPTUFJTiddLFxyXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuICBjc3M6IHtcclxuICAgIHBvc3Rjc3M6IHtcclxuICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgIHRhaWx3aW5kY3NzKCksXHJcbiAgICAgICAgYXV0b3ByZWZpeGVyKCksXHJcbiAgICAgIF0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiAzMDAwLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo1MDAwJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgJy91cGxvYWRzJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6NTAwMCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICBob3N0OiAnMC4wLjAuMCcsIC8vIEFsbG93IG5ldHdvcmsgYWNjZXNzXHJcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsIC8vIEFsbG93IG5ncm9rL3R1bm5lbCBkb21haW5zXHJcbiAgICBobXI6IHtcclxuICAgICAgLy8gY2xpZW50UG9ydDogNDQzLCAvLyBEaXNhYmxlZCBmb3IgbG9jYWwgZGV2IChFbmFibGUgb25seSBmb3IgTmdyb2svSFRUUFMgdHVubmVsaW5nKVxyXG4gICAgfSxcclxuICAgIHdhdGNoOiB7XHJcbiAgICAgIHVzZVBvbGxpbmc6IHRydWUsIC8vIERvY2tlci9XaW5kb3dzIHNvbWV0aW1lcyBuZWVkcyB0aGlzIGZvciBmaWxlIGNoYW5nZXNcclxuICAgIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwXHJcbiAgfVxyXG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFQsU0FBUyxvQkFBb0I7QUFDdlYsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sa0JBQWtCO0FBR3pCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFdBQVcsQ0FBQyxTQUFTLGVBQWU7QUFBQSxFQUNwQyxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsS0FBSztBQUFBLElBQ0gsU0FBUztBQUFBLE1BQ1AsU0FBUztBQUFBLFFBQ1AsWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLE1BQ2Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLFlBQVk7QUFBQSxRQUNWLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLElBQ0EsTUFBTTtBQUFBO0FBQUEsSUFDTixjQUFjO0FBQUE7QUFBQSxJQUNkLEtBQUs7QUFBQTtBQUFBLElBRUw7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFlBQVk7QUFBQTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCx1QkFBdUI7QUFBQSxFQUN6QjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
