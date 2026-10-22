import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Preloads the Latin face of Archivo. The opening cue waits for the fonts, so
 * the browser shouldn't have to find the font through the stylesheet first.
 */
function preloadFont(): Plugin {
  return {
    name: 'preload-font',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      const file = Object.keys(ctx.bundle ?? {}).find((f) => /archivo-latin-wdth-normal-[\w-]+\.woff2$/.test(f));
      if (!file) return;
      return [{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${file}`, crossorigin: '' }, injectTo: 'head' }];
    },
  };
}

// `--mode artifact` builds the hosted preview: fonts come from Google Fonts
// instead of the bundled files, and everything is inlined by tools/artifact.mjs.
export default defineConfig(({ mode }) => ({
  base: mode === 'artifact' ? './' : '/',
  plugins: mode === 'artifact' ? [] : [preloadFont()],
  server: { host: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  resolve: {
    alias:
      mode === 'artifact'
        ? { '@fontsource-variable/archivo/wdth.css': fileURLToPath(new URL('./tools/empty.css', import.meta.url)) }
        : {},
  },
}));
