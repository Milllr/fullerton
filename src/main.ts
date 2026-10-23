import '@fontsource/michroma/400.css';
import '@fontsource/fragment-mono/400.css';
import './styles.css';
import mark from './brand/logo-mark.svg?raw';
import word from './brand/logo-word.svg?raw';
import { credits, shows } from './data/shows';
import { site } from './data/site';
import { esc, setVar, Spring } from './lib/dom';
import { Field } from './light/field';
import { Warmth } from './light/warmth';
import { Cable } from './cable/cable';
import { WorkList } from './work/list';
import { Sheet } from './work/sheet';
import { Showcase } from './work/showcase';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n: number) => String(n).padStart(2, '0');

/* ---------------------------------------------------------------- content */

$('#brand-mark').innerHTML = mark;
$('#contact-logo').innerHTML = `<span class="cl-mark">${mark}</span><span class="cl-word">${word}</span>`;
$('#cover-count').textContent = `${pad(shows.length)} shows`;
$('#work-count').textContent = `${pad(shows.length)} shows with photos`;
$('#all-count').textContent = `${credits.length} productions`;

{
  const rows: string[] = [];
  if (site.email) rows.push(`<a class="ct-line" href="mailto:${site.email}">${esc(site.email)}</a>`);
  if (site.phone) rows.push(`<a class="ct-line" href="tel:${site.phoneTel}">${esc(site.phone)}</a>`);
  rows.push(`<p class="ct-city">${esc(site.person)}, ${esc(site.role)}<br />${esc(site.name)}, ${esc(site.city)}</p>`);
  $('#contact-body').innerHTML = rows.join('');
  if (import.meta.env.DEV && (!site.email || !site.phone)) console.warn('Contact details missing in src/data/site.ts');
  const photo = site.photoCredits.map((c) => `Photos of ${esc(c.for)} by ${esc(c.name)}`).join('. ');
  $('#foot').innerHTML = `<span>${photo}</span><span>${esc(site.name)}, ${new Date().getFullYear()}</span>`;
}

// Film grain for the frosted glass: one small tile of noise, made here rather than downloaded.
{
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  if (g) {
    const d = g.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 128 + (Math.random() + Math.random() - 1) * 120;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    root.style.setProperty('--noise', `url(${c.toDataURL()})`);
  }
}

/* ------------------------------------------------------- warmth, paper */

const warmth = new Warmth();
const field = new Field($<HTMLCanvasElement>('#field'), reduced ? 0.026 : 0.032);
if (!field.ok) root.classList.add('no-gl');
const cable = new Cable($<HTMLCanvasElement>('#cable'), reduced);

/* ------------------------------------------------------------ the work */

const showcase = new Showcase($('#showcase'), shows, reduced);
const list = new WorkList($('#all-list'), credits, shows, reduced);
let workVisible = false;
new IntersectionObserver(([e]) => (workVisible = e.isIntersecting), { rootMargin: '30% 0px' }).observe($('#showcase'));

/* Nav links light for the section you're in. */
{
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav a')];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) links.find((l) => l.hash === `#${e.target.id}`)?.classList.toggle('on', e.isIntersecting);
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  ['work', 'contact'].forEach((id) => io.observe(document.getElementById(id)!));
}

/*
  In-page links (the nav, the skip link, the brand) scroll without touching
  the address. The address only ever holds an open show, so closing a show
  with Back never lands on an old section and jumps the page there.
*/
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a || a.getAttribute('href')!.startsWith('#/') || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const target = document.getElementById(a.getAttribute('href')!.slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  if (a.classList.contains('skip')) $<HTMLAnchorElement>('.sc-open').focus({ preventScroll: true });
});

/* ---------------------------------------------------------------- sheet */

const sheet = new Sheet($('#sheet'), reduced);
sheet.warmth = warmth;
let openedFromPage = false;
/** The link a show was opened from, so closing it puts focus back there. */
let opener: HTMLElement | null = null;

sheet.onClose = () => {
  if (openedFromPage) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    route();
  }
};

function route() {
  const m = location.hash.match(/^#\/work\/([\w-]+)$/);
  const i = m ? shows.findIndex((x) => x.slug === m[1]) : -1;
  if (i >= 0) {
    if (!sheet.isOpen) sheet.open(shows[i], i + 1, opener ?? document.querySelector<HTMLElement>('.sc-open'));
    opener = null;
  } else if (sheet.isOpen) {
    sheet.close();
    openedFromPage = false;
  }
}
addEventListener('hashchange', route);

function openShow(slug: string, from: HTMLElement | null) {
  openedFromPage = true;
  opener = from;
  // Already at this show's address (after Back then Forward, say): setting
  // the same hash fires nothing, so open it directly.
  if (location.hash === `#/work/${slug}`) route();
  else location.hash = `#/work/${slug}`;
}

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#/work/"]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  openShow(a.getAttribute('href')!.slice(7), a);
});
showcase.onOpen = (show, from) => openShow(show.slug, from);

/* ----------------------------------------------------------------- frame */

// Without WebGL the warmth still follows, as a plain gradient.
const fx = new Spring(innerWidth * 0.7, 0.8, 1);
const fy = new Spring(innerHeight * 0.3, 0.8, 1);

function resize() {
  field.resize();
  warmth.resize(innerWidth, innerHeight);
  cable.resize();
  showcase.measure();
}
resize();
addEventListener('resize', resize);
new ResizeObserver(() => showcase.measure()).observe($('#showcase'));

let last = performance.now();
const start = last;
function frame(now: number) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  warmth.update(dt);
  const seed = reduced ? 1 : Math.floor(now / (1000 / 24));
  if (field.ok) field.draw(reduced ? 0 : (now - start) / 1000, scrollY, seed, warmth);
  else {
    const h = warmth.hot;
    setVar(root, '--wx', `${fx.step(h.x, dt).toFixed(0)}px`);
    setVar(root, '--wy', `${fy.step(h.y, dt).toFixed(0)}px`);
    setVar(root, '--wh', h.h.toFixed(2));
  }
  showcase.update(dt, workVisible && !sheet.isOpen);
  list.update(dt);
  sheet.update(dt);
  cable.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
route();

// A first breath of warmth where the light sits, so the page shows what it does before anyone moves.
if (!reduced && !location.hash) setTimeout(() => warmth.bloom(innerWidth * 0.68, innerHeight * 0.4, 1.6, 0.55), 450);

declare global {
  interface Window {
    __fullerton?: boolean;
    __tungsten?: { warmth: Warmth; showcase: Showcase; sheet: Sheet; cable: Cable };
  }
}
window.__fullerton = true;
if (import.meta.env.DEV) window.__tungsten = { warmth, showcase, sheet, cable };
