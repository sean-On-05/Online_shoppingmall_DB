import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import flowbiteReact from "flowbite-react/plugin/vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    // WSL must poll to notice edits made from Windows on /mnt/c.
    watch: {
      usePolling: true,
      interval: 500,
      ignored: ["**/backend/**"],
    },
    proxy: {
      "/api": {
        target: "https://h21yess12.pythonanywhere.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [react(), tailwindcss(), flowbiteReact()],
});
