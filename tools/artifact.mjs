// Builds a single-page preview for hosting as a claude.ai artifact:
// JS and CSS inlined, photos and sketches published next to it.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist-artifact');
execSync('npx vite build --mode artifact --outDir dist-artifact --emptyOutDir', { cwd: root, stdio: 'inherit' });

const html = readFileSync(join(out, 'index.html'), 'utf8');
const js = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
if (!js || !css) throw new Error('could not find built assets');
const code = readFileSync(join(out, js[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(join(out, css[1]), 'utf8');
const body = html
  .split(/<body[^>]*>/)[1]
  .split('</body>')[0]
  .replace(js[0], '')
  .trim();

const page = `<title>Fullerton Productions</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" />
<script>document.documentElement.classList.add('js');</script>
<style>${style}</style>
${body}
<script type="module">${code}</script>
`;
writeFileSync(join(out, 'artifact.html'), page);

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(out, p));
  }
};
walk(join(out, 'shows'));
writeFileSync(join(out, 'files.json'), JSON.stringify(files.map((path) => ({ path }))));
console.log(`artifact.html ${Math.round(page.length / 1024)} KB, ${files.length} files`);
