// Builds a single-page preview for hosting as a claude.ai artifact:
// JS and CSS inlined, photos published next to it.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: on Windows .pathname gives /C:/... and %20 for spaces.
const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'dist-artifact');
execSync('npx vite build --mode artifact --outDir dist-artifact --emptyOutDir', { cwd: root, stdio: 'inherit' });

const html = readFileSync(join(out, 'index.html'), 'utf8');
const js = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
if (!js || !css) throw new Error('could not find built assets');
const code = readFileSync(join(out, js[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(join(out, css[1]), 'utf8');
// The inline head script (the js class) comes across as is.
const headScript = html.split('</head>')[0].match(/<script>[\s\S]*?<\/script>/)?.[0] ?? "<script>document.documentElement.classList.add('js');</script>";
const body = html
  .split(/<body[^>]*>/)[1]
  .split('</body>')[0]
  .replace(js[0], '')
  .trim();

const page = `<title>Fullerton Productions</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fragment+Mono&family=Michroma&display=swap" />
${headScript.replace("classList.replace('no-js', 'js')", "classList.add('js')")}
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
    // Published paths use forward slashes whatever the OS.
    else files.push(relative(out, p).split(sep).join('/'));
  }
};
walk(join(out, 'shows'));
writeFileSync(join(out, 'files.json'), JSON.stringify(files.map((path) => ({ path }))));
console.log(`artifact.html ${Math.round(page.length / 1024)} KB, ${files.length} files`);
