import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo at /Spectrum_Game/ in production.
// Locally (dev) we want root so `npm run dev` just works.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Spectrum_Game/" : "/",
  plugins: [react()],
}));
