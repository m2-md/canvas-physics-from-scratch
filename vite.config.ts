import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// GitHub Pages serves the project under a sub-path: https://m2-md.github.io/canvas-physics-from-scratch/
// GITHUB_ACTIONS is only defined in CI, so `npm run dev` keeps working at the root.
const base = process.env.GITHUB_ACTIONS ? "/canvas-physics-from-scratch/" : "/";

/**
 * The links between the two pages are written root-absolute in the HTML (`/matter.html`, `/`).
 * Vite only rewrites asset paths with base, it does not touch <a href> — served
 * under a sub-path those links would land on the org root. We make them relative
 * in the build output; the source HTML and the dev server are left alone.
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
