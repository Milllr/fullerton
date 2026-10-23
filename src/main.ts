import '@fontsource/michroma/400.css';
import '@fontsource/fragment-mono/400.css';
import './styles.css';
import { credits, shows } from './data/shows';
import { site } from './data/site';
import { esc, setVar, smooth } from './lib/dom';
import { Field } from './lamp/field';
import { Lamp } from './lamp/lamp';
import { renderCredits } from './work/credits';
import { Deck } from './work/deck';
import { Sheet } from './work/sheet';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;
/** The phone layout, the same query as the stylesheet's. */
const phone = matchMedia('(max-width: 699px), (orientation: portrait) and (max-width: 1000px)');
const portrait = () => phone.matches;
const pad = (n: number) => String(n).padStart(2, '0');

/* ---------------------------------------------------------------- content */

$('#cover-count').textContent = `01 to ${pad(shows.length)}`;
renderCredits($('#credits-table'), credits);

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

/* ------------------------------------------------------------ the lamp */

const field = new Field($<HTMLCanvasElement>('#field'), reduced ? 0.028 : 0.034);
if (!field.ok) root.classList.add('no-gl');
const lamp = new Lamp($('#lamp'), { reduced, portrait });

// The opening cue: the lamp comes up from cold once the type is ready.
const begin = () => lamp.open(reduced ? 0 : 2.6);
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(() => setTimeout(begin, reduced ? 0 : 350));

/* ------------------------------------------------------------ the work */

const deck = new Deck($('#index'), $('#deck'), shows, reduced);
let workVisible = false;
new IntersectionObserver(([e]) => (workVisible = e.isIntersecting), { rootMargin: '20% 0px' }).observe($('#work'));

/* Nav links light for the section you're in. */
{
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav a')];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) links.find((l) => l.hash === `#${e.target.id}`)?.classList.toggle('on', e.isIntersecting);
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  ['work', 'credits', 'contact'].forEach((id) => io.observe(document.getElementById(id)!));
}

/*
  In-page links (the nav, the skip link, the brand) scroll without touching
  the address. The address only ever holds an open show, so closing a show
  with Back never lands on an old #credits and jumps the page there.
*/
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a || a.getAttribute('href')!.startsWith('#/') || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const target = document.getElementById(a.getAttribute('href')!.slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  if (a.classList.contains('skip')) $<HTMLAnchorElement>('#index .row').focus({ preventScroll: true });
});

/* ---------------------------------------------------------------- sheet */

const sheet = new Sheet($('#sheet'), reduced);
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
    deck.select(i);
    if (!sheet.isOpen) {
      sheet.open(shows[i], i + 1, opener ?? document.querySelector<HTMLElement>(`.row[data-i="${i}"]`));
      // House to out while the show is up; it comes back when the show closes.
      lamp.cue(0, 0.9);
    }
    opener = null;
  } else if (sheet.isOpen) {
    sheet.close();
    lamp.restore(2.2);
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
deck.onOpen = (show, from) => openShow(show.slug, from);

/* ----------------------------------------------------------------- frame */

/**
 * Where the lamp hangs: low over the cover, flown out to the top while
 * there's reading to do, and partway back down over the contact details.
 */
function flyFor(y: number, vh: number, docH: number) {
  const out = smooth(vh * 0.04, vh * 0.62, y);
  const end = smooth(docH - vh * 1.7, docH - vh, y);
  return out * (1 - 0.55 * end);
}

let last = performance.now();
let docH = root.scrollHeight;
new ResizeObserver(() => (docH = root.scrollHeight)).observe(document.body);
addEventListener('resize', () => field.resize());

function frame(now: number) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const vw = innerWidth;
  const vh = innerHeight;
  // Reads first: the reading line on a touch screen picks the show that's lit.
  if (touch && workVisible && !sheet.isOpen) deck.follow(vh * 0.6);
  const seed = reduced ? 1 : Math.floor(now / (1000 / 24));
  const st = lamp.update(dt, flyFor(scrollY, vh, docH), vw, vh, seed);
  if (field.ok) field.draw(st);
  else {
    setVar(root, '--lx', `${st.x.toFixed(0)}px`);
    setVar(root, '--ly', `${st.y.toFixed(0)}px`);
  }
  deck.update(dt, workVisible && !sheet.isOpen);
  sheet.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
route();

declare global {
  interface Window {
    __fullerton?: boolean;
    __tungsten?: { lamp: Lamp; deck: Deck; sheet: Sheet };
  }
}
window.__fullerton = true;
if (import.meta.env.DEV) window.__tungsten = { lamp, deck, sheet };
