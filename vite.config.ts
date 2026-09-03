import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// GitHub Pages projeyi alt yolda sunar: https://m2-md.github.io/canvas-physics-from-scratch/
// GITHUB_ACTIONS yalnızca CI'da tanımlı olduğundan `npm run dev` kökte çalışmaya devam eder.
const base = process.env.GITHUB_ACTIONS ? "/canvas-physics-from-scratch/" : "/";

/**
 * HTML'deki iki sayfa arası bağlantı kökten mutlak (`/matter.html`, `/`) yazılmış.
 * Vite yalnızca asset yollarını base ile yeniden yazar, <a href> ile ilgilenmez —
 * alt yolda sunulunca bu linkler org kökine düşerdi. Build çıktısında göreli hâle
 * çeviriyoruz; kaynak HTML'e ve dev sunucusuna dokunulmuyor.
 */
function relativePageLinks(): Plugin {
  return {
    name: "relative-page-links",
    apply: "build",
    transformIndexHtml(html) {
      return html
        .replace(/href="\/matter\.html"/g, 'href="./matter.html"')
        .replace(/href="\/"/g, 'href="./index.html"');
    },
  };
}

export default defineConfig({
  base,
  plugins: [relativePageLinks()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        matter: resolve(import.meta.dirname, "matter.html"),
      },
    },
  },
});
