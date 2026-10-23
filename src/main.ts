import '@fontsource/michroma/400.css';
import '@fontsource/fragment-mono/400.css';
import './styles.css';
import mark from './brand/logo-mark.svg?raw';
import word from './brand/logo-word.svg?raw';
import { credits, shows } from './data/shows';
import { site } from './data/site';
import { esc, setVar, Spring } from './lib/dom';
import { Field, type Gobo } from './light/field';
import { Warmth } from './light/warmth';
import { Cable } from './cable/cable';
import { Glint } from './brand/glint';
import { renderList } from './work/list';
import { Preview } from './work/preview';
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
$('#all-count').textContent = `${credits.length} productions`;

{
  const rows: string[] = [];
  if (site.email) rows.push(`<a class="ct-line" href="mailto:${site.email}">${esc(site.email)}</a>`);
  if (site.phone) rows.push(`<a class="ct-line" href="tel:${site.phoneTel}">${esc(site.phone)}</a>`);
  rows.push(`<p class="ct-city">${esc(site.person)}, ${esc(site.role)}<br />${esc(site.name)}, ${esc(site.city)}</p>`);
  $('#contact-body').innerHTML = rows.join('');
  if (import.meta.env.DEV && (!site.email || !site.phone)) console.warn('Contact details missing in src/data/site.ts');
  $('#foot').innerHTML = `<span>${esc(site.name)}, ${new Date().getFullYear()}</span>`;
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
const glint = new Glint($('.cl-mark'), mark, reduced);

/* ------------------------------------------------------------ the work */

const showcase = new Showcase($('#showcase'), shows, reduced);
const preview = new Preview(reduced);
renderList($('#all-list'), credits, shows, preview);

/*
  A glide: the page moves somewhere on an ease in and out, its length
  growing with the distance. Any hand on the page (wheel, touch, keys)
  takes over at once.
*/
let gliding = 0;
function glide(to: number) {
  cancelAnimationFrame(gliding);
  const max = root.scrollHeight - innerHeight;
  const end = Math.max(0, Math.min(max, to));
  if (reduced) return scrollTo(0, end);
  const from = scrollY;
  const d = end - from;
  const ms = Math.min(2400, Math.max(700, 600 + Math.abs(d) * 0.16));
  const t0 = performance.now();
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    scrollTo(0, from + d * ease(t));
    if (t < 1) gliding = requestAnimationFrame(step);
  };
  gliding = requestAnimationFrame(step);
}
for (const ev of ['wheel', 'touchstart', 'keydown'] as const) addEventListener(ev, () => cancelAnimationFrame(gliding), { passive: true });
showcase.glide = glide;
showcase.onSkip = () => glide($('#all-work').getBoundingClientRect().top + scrollY);

/* Who he's lit for, on the cover: each name goes to its first show, and shows it on the way. */
{
  const nets = new Map<string, number>();
  shows.forEach((s, i) => {
    const n = s.short || s.network;
    if (n && n !== 'Private clients' && !nets.has(n)) nets.set(n, i);
  });
  const ul = $('#cover-nets');
  ul.innerHTML = [...nets].map(([n, i]) => `<li><a href="#work" data-i="${i}">${esc(n)}</a></li>`).join('');
  ul.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
    const i = Number(a.dataset.i);
    preview.attach(a, shows[i]);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      preview.show(null);
      showcase.goTo(i);
    });
  });
}
let workVisible = false;
// The last entry is the current state when one batch holds both coming and going.
new IntersectionObserver((es) => (workVisible = es[es.length - 1].isIntersecting), { rootMargin: '30% 0px' }).observe($('#showcase'));

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
  glide(target.getBoundingClientRect().top + scrollY);
  if (a.classList.contains('skip')) $<HTMLAnchorElement>('.sc-open').focus({ preventScroll: true });
});

/* ---------------------------------------------------------------- sheet */

const sheet = new Sheet($('#sheet'), reduced);
sheet.warmth = warmth;
let openedFromPage = false;
/** The link a show was opened from, so closing it puts focus back there. */
let opener: HTMLElement | null = null;

// Close at once, so a second Escape or tap can't go back twice and leave the site.
sheet.onClose = () => {
  if (!sheet.isOpen) return;
  sheet.close();
  if (openedFromPage) {
    openedFromPage = false;
    history.back();
  } else history.replaceState(null, '', location.pathname + location.search);
};

function route() {
  const m = location.hash.match(/^#\/work\/([\w-]+)$/);
  const i = m ? shows.findIndex((x) => x.slug === m[1]) : -1;
  if (i >= 0) {
    // A different show's address while one is open (typed, or Back and Forward) opens that one.
    if (sheet.slug !== shows[i].slug) sheet.open(shows[i], i + 1, opener ?? document.querySelector<HTMLElement>('.sc-open'));
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

// The name catches the warmth near it.
const nameEl = $('#name');
let nameBox = { x: 0, y: 0 };
const measureName = () => {
  const r = nameEl.getBoundingClientRect();
  nameBox = { x: r.left, y: r.top + scrollY };
};
measureName();
addEventListener('resize', measureName);
document.fonts.ready.then(measureName);
function warmName(y: number) {
  const h = warmth.hot;
  const top = nameBox.y - y;
  if (top > innerHeight || top < -200) return;
  // With no warmth on it there's nothing to move, and moving it would repaint the name every frame of a scroll.
  const hh = Math.min(0.85, h.h * 1.3).toFixed(2);
  if (hh === '0.00' && nameEl.style.getPropertyValue('--hh') === hh) return;
  setVar(nameEl, '--hx', `${(h.x - nameBox.x).toFixed(0)}px`);
  setVar(nameEl, '--hy', `${(h.y - top).toFixed(0)}px`);
  setVar(nameEl, '--hh', hh);
  setVar(nameEl, '--hr', String(Math.round(Math.max(innerWidth, innerHeight) * 0.22)));
}

/*
  The window gobo on the cover: where its light falls (a skewed window,
  drifting very slowly like the sun moving), fading out as the cover
  scrolls away, and the soft shadow of the pointer in it.
*/
const handOn = new Spring(0, 1.6, 1);
const gobo: Gobo = { q: [0, 0, 0, 0, 0, 0, 0, 0], strength: 0, hand: [0, 0, 0] };
function placeGobo(t: number, y: number, dt: number) {
  const w = innerWidth;
  const h = innerHeight;
  const tall = h > w * 1.05;
  const top = -y;
  const sway = reduced ? 0 : Math.sin(t * 0.031) * 0.012;
  const lift = reduced ? 0 : Math.sin(t * 0.023 + 1.3) * 0.01;
  // Top left, top right, bottom right, bottom left, as fractions of the window, cast down and across from the upper right.
  const c = tall
    ? [0.1, 0.07, 0.86, -0.01, 1.06, 0.5, 0.2, 0.6]
    : [0.46, 0.05, 0.84, -0.03, 1.0, 0.66, 0.56, 0.86];
  for (let i = 0; i < 8; i += 2) {
    gobo.q[i] = (c[i] + sway * (i === 2 || i === 4 ? 1.6 : 1)) * w;
    gobo.q[i + 1] = top + (c[i + 1] + lift * (i >= 4 ? 1.8 : 1)) * h;
  }
  gobo.strength = Math.max(0, 1 - y / (h * 0.9));
  const p = warmth.pointer;
  gobo.hand[0] = p.x;
  gobo.hand[1] = p.y;
  gobo.hand[2] = reduced ? (p.here ? 1 : 0) : handOn.step(p.here ? 1 : 0, dt);
}

let docH = root.scrollHeight;
new ResizeObserver(() => (docH = root.scrollHeight)).observe(document.body);

let last = performance.now();
const start = last;
function frame(now: number) {
  // Ask for the next frame first: whatever goes wrong in this one, the page keeps moving.
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  // Layout reads first, once, before anything writes.
  const y = scrollY;
  warmth.update(dt, y);
  const seed = reduced ? 1 : Math.floor(now / (1000 / 24));
  const t = reduced ? 0 : (now - start) / 1000;
  placeGobo(t, y, dt);
  if (field.ok) field.draw(t, y, seed, warmth, gobo);
  else {
    const h = warmth.hot;
    setVar(root, '--wx', `${fx.step(h.x, dt).toFixed(0)}px`);
    setVar(root, '--wy', `${fy.step(h.y, dt).toFixed(0)}px`);
    setVar(root, '--wh', h.h.toFixed(2));
  }
  warmName(y);
  showcase.update(dt, workVisible && !sheet.isOpen, y);
  preview.update(dt);
  sheet.update(dt);
  cable.update(dt, y, docH);
  glint.update(dt, warmth.pointer, y);
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
