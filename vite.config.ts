import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const empty = fileURLToPath(new URL('./tools/empty.css', import.meta.url));

// `--mode artifact` builds the hosted preview: fonts come from Google Fonts
// instead of the bundled files, and everything is inlined by tools/artifact.mjs.
export default defineConfig(({ mode }) => ({
  base: mode === 'artifact' ? './' : '/',
  server: { host: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  resolve: {
    alias:
      mode === 'artifact'
        ? { '@fontsource/michroma/400.css': empty, '@fontsource/fragment-mono/400.css': empty }
        : {},
  },
}));
