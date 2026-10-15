import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import './desk/desk.css';

import { allShows, credits, hero, imageUrl, shows, type Show } from './data/shows';
import { site } from './data/site';
import { PanelRig, Rig, type Pool } from './engine/rig';
import { Plate, type Flood, type SpotLight } from './engine/plate';
import { Shaft, type Beam } from './engine/shaft';
import { Fixture, PanelFixture } from './engine/fixture';
import { buildSprites, releaseSprites, type GoboSprites } from './engine/gobos';
import { rgbCss } from './engine/kelvin';
import { setVar } from './engine/css';
import { Desk, HAZER, PANELS, SPOTS, strobeHz, type AttrKey } from './desk/model';
import { DeskUI } from './desk/ui';
import { renderCredits } from './ui/credits';
import { Sheet } from './ui/detail';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const root = document.documentElement;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ DOM */

const meta = (s: Show) => [s.network, s.year].filter(Boolean).join(', ');

function plateMarkup(s: Show, cls: string, eager = false) {
  const im = s.images.find((i) => i.id === s.key)!;
  return `<a class="plate ${cls}" href="#/work/${s.slug}" data-slug="${s.slug}" aria-label="${esc(s.title)}, ${esc(meta(s))}. Open the photos.">
    <div class="plate-stage" style="--ar:${im.w} / ${im.h}">
      <img alt="${esc(s.title)}" ${eager ? '' : 'loading="lazy"'} decoding="async" width="${im.w}" height="${im.h}" src="${imageUrl(s.slug, s.key, 'm')}" />
    </div>
  </a>`;
}

$('#hero-plate').innerHTML = `${plateMarkup(hero, 'plate-hero', true)}
  <p class="hero-cap"><a href="#/work/${hero.slug}">${esc(hero.title)}</a><span>${esc(meta(hero))}</span></p>`;

$('#plates').innerHTML = shows
  .map(
    (s, i) => `<article class="show show-${i + 1}" data-slug="${s.slug}">
      ${plateMarkup(s, '')}
      <div class="show-cap">
        <h3 class="show-title"><a href="#/work/${s.slug}" tabindex="-1">${esc(s.title)}</a></h3>
        <p class="show-meta">${esc(meta(s))}</p>
      </div>
    </article>`,
  )
  .join('');

renderCredits($('#credits-table'), credits);

{
  const body = $('#contact-body');
  const lines: string[] = [];
  if (site.email) lines.push(`<a class="contact-line lit" href="mailto:${esc(site.email)}"><span class="lit-line">${esc(site.email)}</span></a>`);
  if (site.phone) lines.push(`<a class="contact-line lit" href="tel:${esc(site.phoneTel || site.phone.replace(/[^+\d]/g, ''))}"><span class="lit-line">${esc(site.phone)}</span></a>`);
  if (lines.length) {
    body.innerHTML = lines.join('') + `<p class="contact-city">${esc(site.city)}</p>`;
  } else if (import.meta.env.DEV) {
    body.innerHTML = `<p class="contact-todo">Email and phone go in <code>src/data/site.ts</code>. This note only shows in development.</p>`;
  } else {
    $('#contact').hidden = true;
    document.querySelector('.nav a[href="#contact"]')?.remove();
  }
}

$('#foot').innerHTML = `
  <p>© ${new Date().getFullYear()} ${esc(site.name)}, ${esc(site.city)}</p>
  ${site.photoCredits.map((c) => `<p>Photography of ${esc(c.for)} by ${esc(c.name)}</p>`).join('')}`;

/**
 * An IntersectionObserver rooted on the document. Inside a cross-origin iframe
 * (the hosted preview) rootMargin is ignored unless the root is explicit.
 */
function observer(cb: IntersectionObserverCallback, opts: IntersectionObserverInit = {}) {
  try {
    return new IntersectionObserver(cb, { root: document, ...opts });
  } catch {
    return new IntersectionObserver(cb, opts);
  }
}

/* Lit type: an outlined word with a filled copy that only shows under the beam. */
const litEls = [...document.querySelectorAll<HTMLElement>('.lit')];
for (const el of litEls) {
  const fill = document.createElement('span');
  fill.className = 'lit-fill';
  fill.setAttribute('aria-hidden', 'true');
  fill.innerHTML = el.innerHTML;
  el.append(fill);
}

/* Nav keys light for the section you're in. */
{
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav a')];
  const io = observer(
    (entries) => {
      for (const e of entries) {
        const a = links.find((l) => l.hash === `#${e.target.id}`);
        a?.classList.toggle('on', e.isIntersecting);
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  ['work', 'credits', 'contact'].forEach((id) => document.getElementById(id) && io.observe(document.getElementById(id)!));
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
  // Line the section's heading up under the rig. Contact is short and is the
  // point of the section: if its details would end up behind the desk bar
  // (a phone held sideways), scroll on until they clear it.
  const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  let y = scrollY + target.getBoundingClientRect().top - pad;
  const details = target.dataset.showAll != null ? target.lastElementChild : null;
  if (details) {
    const bottom = scrollY + details.getBoundingClientRect().bottom;
    const deskEdge = document.getElementById('desk')!.getBoundingClientRect().top || innerHeight;
    y = Math.max(y, bottom - (deskEdge - 24));
  }
  scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
  // Move keyboard focus along with the view, to the section's heading.
  const h = target.querySelector<HTMLElement>('h1, h2') ?? target;
  if (!h.hasAttribute('tabindex')) h.tabIndex = -1;
  h.focus({ preventScroll: true });
});

/* --------------------------------------------------------------- engine */

/*
  The rig, left to right along the truss: Spot L (fixture 1), Panel L (3),
  Panel R (4), Spot R (2). The spots hang at the wings on moving heads and
  cross their beams; the soft panels hang inside, pointing straight down.
  On a touch screen the panels come up as a fill and the spots find the show
  you're looking at by themselves.
*/
const touchMode = coarse;
const spots = SPOTS.map(() => {
  const r = new Rig();
  r.reducedMotion = reduced;
  return r;
});
const panels = PANELS.map(() => new PanelRig());
const spotFx = SPOTS.map((id) => new Fixture($<HTMLCanvasElement>(`#fx-${id}`)));
const panelFx = PANELS.map((id) => new PanelFixture($<HTMLCanvasElement>(`#fx-${id}`)));
/** Top left of each fixture canvas on screen. */
const spotAt = spots.map(() => ({ x: 0, y: 0 }));
const panelAt = panels.map(() => ({ x: 0, y: 0 }));
/** Spot L lands right of centre and Spot R left of it, so the beams cross. */
const crossOf = (i: number) => (i === 0 ? 1 : -1);

/** Gobo sprites for a focus and frost, shared between the spots. */
const spriteCache = new Map<string, GoboSprites>();
const spriteKey = (focus: number, frost: number) => `${focus.toFixed(2)}|${frost.toFixed(2)}`;
function spritesFor(focus: number, frost: number) {
  const key = spriteKey(focus, frost);
  let s = spriteCache.get(key);
  if (!s) {
    s = buildSprites(focus, frost);
    spriteCache.set(key, s);
    // Keep a few; release the rest so phones don't run out of canvas memory.
    while (spriteCache.size > 3) {
      const [oldKey, old] = spriteCache.entries().next().value!;
      spriteCache.delete(oldKey);
      if (!spotSprites.some((st) => st.sprites === old)) releaseSprites(old);
    }
  }
  return s;
}
/** The masks each spot is using right now. */
const spotSprites: { key: string; sprites: GoboSprites }[] = [];
spots.forEach(() => spotSprites.push({ key: spriteKey(0.7, 0), sprites: spritesFor(0.7, 0) }));
let lastSpriteBuild = 0;
function updateSprites(i: number, now: number) {
  const { focus, frost } = spots[i].out;
  const key = spriteKey(focus, frost);
  const st = spotSprites[i];
  if (key === st.key) return;
  if (!spriteCache.has(key)) {
    // Turning the focus encoder shouldn't rebuild masks every frame.
    if (now - lastSpriteBuild < 200) return;
    lastSpriteBuild = now;
  }
  st.sprites = spritesFor(focus, frost);
  st.key = key;
}

const shaft = Shaft.create($<HTMLCanvasElement>('#shaft'));
if (!shaft) root.classList.add('no-shaft');
/** Development only: ?fast renders the haze coarsely and takes bigger time steps, for headless tests. */
const fast = import.meta.env.DEV && new URLSearchParams(location.search).has('fast');
if (fast && shaft) shaft.maxScale = 0.12;

const plates: Plate[] = [];
const heroPlate = new Plate($('.plate-hero'), hero.slug, hero.images.find((i) => i.id === hero.key)!, 0.55, 0.8);
plates.push(heroPlate);
document.querySelectorAll<HTMLElement>('#plates .plate').forEach((el, i) => {
  const s = shows[i];
  plates.push(new Plate(el, s.slug, s.images.find((im) => im.id === s.key)!));
});
const plateBySlug = (slug: string) => plates.find((p) => p.slug === slug) ?? null;
const rectOf = (p: Plate) => (p.visible ? p.rect : p.stage.getBoundingClientRect());

const near = observer(
  (entries) => {
    for (const e of entries) {
      const p = plates.find((pl) => pl.el === e.target);
      if (p && e.isIntersecting) {
        p.near = true;
        p.load();
      }
    }
  },
  { rootMargin: '900px 0px' },
);
const seen = observer(
  (entries) => {
    for (const e of entries) {
      const p = plates.find((pl) => pl.el === e.target);
      if (!p) continue;
      p.visible = e.isIntersecting;
      if (!p.visible) p.clearLight();
    }
  },
  { rootMargin: '120px 0px' },
);
plates.forEach((p) => {
  near.observe(p.el);
  seen.observe(p.el);
});
// Plates resize their canvases when their own size changes (fonts, layout), not on every window resize.
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) plates.find((p) => p.stage === e.target)?.resize();
  });
  plates.forEach((p) => ro.observe(p.stage));
}

const litVisible = new Set<HTMLElement>();
const litSeen = observer((entries) => {
  for (const e of entries) {
    const el = e.target as HTMLElement;
    if (e.isIntersecting) litVisible.add(el);
    else litVisible.delete(el);
  }
});
litEls.forEach((el) => litSeen.observe(el));

/* ----------------------------------------------------------------- desk */

const desk = new Desk();
const goboIcons = spotSprites[0].sprites.pool.map((c) => {
  const t = document.createElement('canvas');
  t.width = t.height = 44;
  const x = t.getContext('2d')!;
  x.fillStyle = '#000';
  x.beginPath();
  x.arc(22, 22, 22, 0, TAU);
  x.fill();
  x.drawImage(c, 0, 0, 44, 44);
  return t.toDataURL();
});
const deskUI = new DeskUI($('#desk'), desk, goboIcons, reduced);
deskUI.onOpenChange = () => requestAnimationFrame(() => measureDesk());

desk.onCue = (c) => {
  const slug = c?.slug ?? (c?.plates ? Object.values(c.plates)[0] : undefined);
  const p = slug ? plateBySlug(slug) : null;
  if (!p) return;
  const r = p.stage.getBoundingClientRect();
  const visibleH = deskTop;
  if (r.top < 80 || r.bottom > visibleH) {
    const y = scrollY + r.top + r.height / 2 - (80 + visibleH) / 2;
    scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
  }
};

/* -------------------------------------------------------------- layout */

let vw = innerWidth, vh = innerHeight;
const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;
/** Top edge of the desk: the part of the screen the light can usefully reach. */
let deskTop = innerHeight;
/** Centre line of the truss the rig hangs from. */
let trussY = 53;
let panelUsable = 0;

function measureDesk() {
  deskTop = $('#desk').getBoundingClientRect().top || vh;
}

let laidWidth = '';

function layout() {
  vw = innerWidth;
  vh = innerHeight;
  // A phone's address bar showing or hiding changes only the height: the rig
  // and the plates stay as they are, and only what depends on height updates.
  const widthKey = `${vw}@${devicePixelRatio || 1}@${vh < 540}`;
  const widthChanged = widthKey !== laidWidth;
  laidWidth = widthKey;
  const small = vw < 720;
  // Short screens (a phone held sideways) hang the rig small too, to leave room for the wordmark.
  const k = small || vh < 540 ? 0.45 : vw < 1100 ? 0.7 : 0.9;
  // Spots at the wings, panels inside: Spot L, Panel L, Panel R, Spot R.
  const xs = small ? [0.09, 0.36, 0.64, 0.91] : [0.09, 0.38, 0.62, 0.91];
  trussY = ($('.truss').getBoundingClientRect().top || 46) + 7;
  measureDesk();
  // The panels are hung for the screen with the desk tucked away; opening the desk doesn't move them.
  if ((widthChanged && !deskUI.isOpen) || !panelUsable) panelUsable = Math.min(vh, deskTop);
  const usable = panelUsable;
  const hang = (fx: Fixture | PanelFixture, x: number, at: { x: number; y: number }) => {
    if (widthChanged) fx.resize(k);
    at.x = Math.round(x * vw - fx.w / 2);
    at.y = Math.round(trussY);
    fx.canvas.style.transform = `translate(${at.x}px, ${at.y}px)`;
  };
  hang(spotFx[0], xs[0], spotAt[0]);
  hang(panelFx[0], xs[1], panelAt[0]);
  hang(panelFx[1], xs[2], panelAt[1]);
  hang(spotFx[1], xs[3], spotAt[1]);
  spots.forEach((r, i) => r.layout(vw, vh, spotAt[i].x + spotFx[i].pivotX, spotAt[i].y + spotFx[i].pivotY));
  panels.forEach((p, i) => p.layout(vw, usable, panelAt[i].x + panelFx[i].pivotX, panelAt[i].y + panelFx[i].pivotY, small));
  shaft?.resize(vw, vh, lowPower);
  plates.forEach((p) => p.resize());
}

/* ---------------------------------------------------------------- input */

let pointer: { x: number; y: number } | null = null;
let lastInput = performance.now();
const IDLE_AFTER = 6000;
/** A plate the beams are briefly committed to: keyboard focus, or a click that opens it. */
let momentary: { plate: Plate; fraction: number } | null = null;
/** On a touch screen a finger on the page pulls both spots onto it, until a moment after it lifts. */
let finger: { x: number; y: number } | null = null;
let fingerDown = false;
let fingerUp = -1e9;
const FINGER_HOLD = 1200;

function dropAutoSweep() {
  if (desk.exec[3].auto) {
    desk.exec[3].level = 0;
    desk.exec[3].auto = false;
    desk.emit();
  }
}

function onInput(x: number, y: number) {
  pointer = { x, y };
  lastInput = performance.now();
  if (momentary && momentary.fraction < 0.9) momentary = null;
  dropAutoSweep();
}

const overControls = (t: EventTarget | null) => !!(t as Element)?.closest?.('#desk, .sheet');

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  finishOpening();
  if (overControls(e.target)) {
    // Working the desk shouldn't drag the beams over to it.
    lastInput = performance.now();
    return;
  }
  onInput(e.clientX, e.clientY);
}, { passive: true });

function onTouch(e: TouchEvent) {
  const t = e.touches[0];
  lastInput = performance.now();
  if (!t || overControls(e.target)) return;
  if (!touchMode) return onInput(t.clientX, t.clientY);
  finger = { x: t.clientX, y: t.clientY };
  fingerDown = true;
  if (momentary && momentary.fraction < 0.9) momentary = null;
}
addEventListener('touchstart', (e) => {
  finishOpening();
  onTouch(e);
}, { passive: true });
addEventListener('touchmove', onTouch, { passive: true });
const onLift = (e: TouchEvent) => {
  if (!e.touches.length && fingerDown) {
    fingerDown = false;
    fingerUp = performance.now();
  }
};
addEventListener('touchend', onLift, { passive: true });
addEventListener('touchcancel', onLift, { passive: true });

addEventListener('keydown', () => {
  finishOpening();
  // Typing at the desk counts as being here; the idle sweep waits.
  lastInput = performance.now();
});
addEventListener('pointerdown', () => (lastInput = performance.now()), { passive: true });

// Keyboard focus on a plate swings the beams onto it.
document.addEventListener('focusin', (e) => {
  const el = (e.target as HTMLElement).closest?.('.plate');
  const p = el && plates.find((pl) => pl.el === el);
  if (p) {
    momentary = { plate: p, fraction: 0.3 };
    lastInput = performance.now();
  }
});
document.addEventListener('focusout', (e) => {
  if (momentary && momentary.fraction < 0.9 && (e.target as HTMLElement).closest?.('.plate')) momentary = null;
});

/* ---------------------------------------------------------------- sheet */

const sheet = new Sheet($('#sheet'), reduced);
let openedFromPage = false;
sheet.onClose = () => {
  if (openedFromPage) history.back();
  else history.replaceState(null, '', location.pathname + location.search);
  sheet.close();
  momentary = null;
};

/** The link a show was opened from, so closing it puts focus back there. */
let opener: HTMLElement | null = null;

function route() {
  const m = location.hash.match(/^#\/work\/([\w-]+)$/);
  const s = m && allShows.find((x) => x.slug === m[1]);
  if (s) {
    if (!sheet.isOpen) sheet.open(s, opener);
    opener = null;
  } else if (sheet.isOpen) {
    sheet.close();
  }
}
addEventListener('hashchange', route);

// Opening a show: swing onto the plate and open the beams wide, then the sheet.
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#/work/"]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  const slug = a.getAttribute('href')!.slice(7);
  const p = plates.find((pl) => pl.slug === slug && pl.visible);
  const openIt = () => {
    openedFromPage = true;
    opener = a;
    // Already at this show's address (say, after Back then Forward): setting
    // the same hash fires nothing, so open it directly.
    if (location.hash === `#/work/${slug}`) route();
    else location.hash = `#/work/${slug}`;
  };
  if (p && !reduced) {
    momentary = { plate: p, fraction: 0.95 };
    setTimeout(openIt, 520);
  } else openIt();
});

/* ------------------------------------------------- opening cue and lamps */

let opening = false;
let openStart = performance.now();
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
/** Per spot: when its lamp last struck (drives the flicker), and a Reset in progress. */
const lamps = spots.map(() => ({ strikeAt: -1e9, on: true, resetUntil: 0 }));

/** Lamp level after a strike: a couple of flickers, then a slow fade up. */
function strikeCurve(s: number) {
  if (s < 0) return 0;
  if (s < 60) return 0.55;
  if (s < 140) return 0.08;
  if (s < 200) return 0.7;
  if (s < 300) return 0.25;
  return 0.25 + 0.75 * ease((s - 300) / 1100);
}

function lampLevel(i: number, now: number) {
  // In the opening cue the spots strike one after the other.
  if (opening) return strikeCurve(now - openStart - 1900 - i * 160);
  const l = lamps[i];
  return l.on ? strikeCurve(now - l.strikeAt) : 0;
}

desk.onReset = (id) => {
  const l = lamps[SPOTS.indexOf(id)];
  if (l) l.resetUntil = performance.now() + 1500;
};

let fillRaised = false;
/** On a touch screen the panels come up by themselves once the rig is lit. */
function autoFill() {
  if (!touchMode || fillRaised) return;
  fillRaised = true;
  const e = desk.exec[4];
  if (e.level === 0 && !e.flash) {
    e.level = 0.72;
    e.auto = true;
    desk.emit();
  }
}

function finishOpening() {
  if (!opening) return;
  opening = false;
  root.classList.add('cue-done');
  [...spotFx, ...panelFx].forEach((f) => (f.progress = 1));
  heroPlate.renderSketch(1);
  lamps.forEach((l) => (l.strikeAt = -1e9));
  autoFill();
}

function runOpening(now: number) {
  const t = now - openStart;
  spotFx.forEach((f) => (f.progress = ease((t - 150) / 900)));
  panelFx.forEach((f) => (f.progress = ease((t - 420) / 900)));
  if (heroPlate.data) heroPlate.renderSketch(ease((t - 500) / 1700));
  if (t > 3600) finishOpening();
}

/* ---------------------------------------------------------------- frame */

type RGB = [number, number, number];
let last = performance.now();
let clock = 0;
let hazeClock = 0;
let phaserClock = 0;
let roamClock = 0;
let sweepShown = 0;
const bounce: RGB = [0, 0, 0];
let bounceAmt = 0;
const bouncePos = { x: 0, y: 0 };
const bounceAxes = { x: 1, y: 1 };
const deskEl = $('#desk');
let subjectPlate: Plate | null = null;

function wordmarkPoint() {
  const wm = $('#wordmark').getBoundingClientRect();
  return { x: wm.left + wm.width * 0.42, y: wm.top + wm.height * 0.5 };
}

function zoomToCover(rig: Rig, p: Plate, fraction: number) {
  const r = rectOf(p);
  const want = Math.min(r.width, r.height) * fraction;
  const pool = rig.pool();
  const base = rig.baseZoom();
  const dist = pool.ry / (0.25 + 0.75 * rig.out.iris) / Math.tan(((base + rig.zoomBoost) / 2) * (Math.PI / 180));
  const deg = 2 * Math.atan(want / Math.max(1, dist)) * (180 / Math.PI);
  return Math.max(0, Math.min(60, deg - base));
}

/** The visible part of the page below the rig and above the desk. */
const viewTop = () => trussY + 60;
const viewBottom = () => Math.min(vh, deskTop);

/** The show nearest the middle of the screen. It holds on a little so the spots don't flick between two. */
function findSubject(visible: Plate[]) {
  const top = viewTop(), bottom = viewBottom();
  const span = Math.max(1, bottom - top);
  const cy = (top + bottom) / 2;
  const score = (p: Plate) => {
    const r = p.rect;
    if (r.bottom < top + 40 || r.top > bottom - 40) return Infinity;
    return Math.abs((r.top + r.bottom) / 2 - cy) / span;
  };
  let best: Plate | null = null;
  let bestS = Infinity;
  for (const p of visible) {
    const s = score(p);
    if (s < bestS) {
      bestS = s;
      best = p;
    }
  }
  if (subjectPlate?.visible) {
    const cur = score(subjectPlate);
    if (cur < Infinity && cur - bestS < 0.15) {
      best = subjectPlate;
      bestS = cur;
    }
  }
  subjectPlate = bestS < 0.75 ? best : null;
  return subjectPlate;
}

let frameFailed = false;
/** One error shouldn't stop the lights for good: log it once and keep going. */
function frame(now: number) {
  try {
    step(now);
  } catch (e) {
    if (!frameFailed) console.error(e);
    frameFailed = true;
  }
  requestAnimationFrame(frame);
}

let sheetSince = 0;

function step(now: number) {
  const dt = Math.min(fast ? 0.25 : 0.05, (now - last) / 1000);
  last = now;

  // With a show's photos open the page is covered: once the lights have
  // faded, stop drawing a stage nobody can see.
  if (sheet.isOpen) {
    sheetSince ||= now;
    if (now - sheetSince > 700) return;
  } else sheetSince = 0;

  if (!reduced) clock += dt;
  if (opening) runOpening(now);

  // Read everything from the layout first, then write, so the browser lays
  // the page out once per frame rather than once per element.
  const lightVisible = plates.filter((p) => p.visible);
  for (const p of lightVisible) p.measure();
  const litRects = [...litVisible].map((el) => [el, el.getBoundingClientRect()] as const);
  const wmPoint = wordmarkPoint();

  const haze = desk.value(HAZER, 'haze').v / 100;
  const fan = desk.value(HAZER, 'fan').v / 100;

  // Each spot's output, resolved from the desk: dimmer, Grand Master, B.O., lamp strike, strobe.
  spots.forEach((rig, i) => {
    const id = SPOTS[i];
    const v = (a: AttrKey) => desk.value(id, a).v;
    rig.out.zoom = v('zoom');
    rig.out.iris = v('iris') / 100;
    rig.out.cct = v('cct');
    rig.out.gobo = Math.round(v('gobo'));
    rig.out.goboRot = v('goboRot') / 100;
    rig.out.focus = v('focus') / 100;
    rig.out.frost = v('frost') / 100;
    rig.out.haze = haze;
    rig.out.fan = fan;
    updateSprites(i, now);
    // The lamp follows the desk's output, however it got there (a value,
    // Clear, Oops, Blind): switching on strikes it.
    const lamp = lamps[i];
    const lampOn = v('lamp') >= 0.5;
    if (lampOn && !lamp.on) lamp.strikeAt = now;
    lamp.on = lampOn;
    const shutter = v('shutter');
    const strobe = shutter >= 0.5 && !reduced ? ((clock * strobeHz(shutter)) % 1 < 0.5 ? 1 : 0) : 1;
    rig.intensity = sheet.isOpen ? 0 : desk.intensity(id) * lampLevel(i, now) * strobe;
  });

  // The panels are LED: no lamp to strike, but they fade rather than pop.
  panels.forEach((pr, j) => {
    const id = PANELS[j];
    const want = sheet.isOpen || opening ? 0 : desk.intensity(id);
    const rate = want > pr.intensity ? 2.2 : 9;
    pr.intensity += (want - pr.intensity) * Math.min(1, dt * rate);
    if (Math.abs(want - pr.intensity) < 0.001) pr.intensity = want;
    pr.cct = desk.value(id, 'cct').v;
  });

  // Where the heads should point.
  const pos = SPOTS.map((id) => desk.position(id));
  const allFollow = pos.every((p) => p.kind === 'follow');

  // Executor 3: a pan and tilt sweep phaser, mirrored so the beams cross. It
  // comes up by itself on a desktop when nobody's touching anything.
  if (!touchMode && !opening && allFollow && !momentary && now - lastInput > IDLE_AFTER && !sheet.isOpen && !reduced && desk.exec[3].level === 0 && !desk.exec[3].flash) {
    desk.exec[3].level = 0.55;
    desk.exec[3].auto = true;
    desk.emit();
  }
  sweepShown += (desk.sweepSize() - sweepShown) * Math.min(1, dt * 1.5);
  if (sweepShown > 0.005 && !reduced) phaserClock += dt;
  if (!reduced) roamClock += dt;

  const fingerLive = touchMode && !!finger && (fingerDown || now - fingerUp < FINGER_HOLD);
  const subject = touchMode && !opening ? findSubject(lightVisible) : null;
  const slugs = pos.map((p) => (p.kind === 'plate' ? p.slug : null));
  const sharePlate = !!slugs[0] && slugs[0] === slugs[1];
  const cue = desk.currentCue();
  const top = viewTop(), bottom = viewBottom();

  spots.forEach((rig, i) => {
    const p = pos[i];
    const cross = crossOf(i);
    let target = pointer ?? wmPoint;
    let cover: { plate: Plate; fraction: number } | null = null;
    let offset = 0;
    let roam = false;
    let omega = 5.2;
    if (momentary) {
      cover = momentary;
    } else if (p.kind === 'plate') {
      const pl = plateBySlug(p.slug);
      if (pl) {
        cover = { plate: pl, fraction: sharePlate ? 0.38 : 0.46 };
        if (sharePlate) offset = 0.18 * cross;
      }
    } else if (p.kind === 'angles') {
      target = rig.pointFor(p.pan, p.tilt);
    } else if (touchMode && !opening) {
      if (fingerLive) {
        target = finger!;
      } else {
        roam = true;
        omega = 3;
        if (subject) {
          cover = { plate: subject, fraction: 0.3 };
          offset = 0.18 * cross;
        } else {
          target = { x: vw / 2 + cross * vw * 0.12, y: (top + bottom) / 2 };
        }
      }
    }
    let span = { w: vw * 0.6, h: (bottom - top) * 0.6 };
    if (cover) {
      const r = rectOf(cover.plate);
      target = { x: r.left + r.width * (0.5 + offset), y: r.top + r.height / 2 };
      span = { w: r.width, h: r.height };
    }
    // A slow roam over the subject, the two spots mirrored.
    if (roam && !reduced) {
      const ph = i === 0 ? 0 : Math.PI;
      target = {
        x: target.x + 0.22 * span.w * Math.sin((TAU * roamClock) / 11 + ph),
        y: Math.max(top, Math.min(bottom, target.y + 0.22 * span.h * Math.sin((TAU * roamClock) / 7 + ph))),
      };
    }
    if (now < lamps[i].resetUntil) target = rig.pointFor(0, 6);

    if (sweepShown > 0.005 && !reduced) {
      const free = p.kind === 'follow' && !momentary && !touchMode;
      const base = free ? { x: vw / 2, y: bottom * 0.58 } : target;
      const ax = (free ? vw * 0.3 : vw * 0.12) * sweepShown * cross;
      const ay = (free ? bottom * 0.2 : bottom * 0.08) * sweepShown;
      const blend = free ? Math.min(1, sweepShown / 0.25) : 1;
      const sx = base.x + ax * Math.sin((TAU * phaserClock) / 24);
      const sy = base.y + ay * Math.sin((TAU * phaserClock) / 16 + 0.9);
      target = { x: target.x + (sx - target.x) * blend, y: target.y + (sy - target.y) * blend };
    }
    rig.target = target;

    // Cue fade times set how heavily the heads move.
    rig.omega = p.kind !== 'follow' && p.from === 'cue' && cue ? Math.max(2.5, Math.min(8, 15 / cue.fade)) : omega;
    const hold = desk.exec[1].paused && p.kind !== 'follow' && p.from === 'cue';
    const zoomGoal = cover && desk.value(SPOTS[i], 'zoom').src !== 'programmer' ? zoomToCover(rig, cover.plate, cover.fraction) : 0;
    rig.zoomBoost += (zoomGoal - rig.zoomBoost) * Math.min(1, dt * 4);
    rig.update(dt, hold);
    desk.live[SPOTS[i]] = rig.degrees();
  });

  hazeClock += dt * (0.25 + fan * 1.75) * (reduced ? 0 : 1);

  // Draw the fixtures and gather what each light is doing on the page.
  const beams: Beam[] = [];
  const lights: SpotLight[] = [];
  const spotPools: Pool[] = [];
  spots.forEach((rig, i) => {
    const pool = rig.pool();
    const colour = rig.colour();
    const I = rig.intensity;
    rig.poolI = I * rig.throwFalloff();
    const l = spotFx[i].draw(rig.pan, rig.tilt, I, colour);
    const sp = spotSprites[i].sprites;
    const mask = sp.pool[rig.out.gobo];
    shaft?.setGobo(i as 0 | 1, mask);
    spotPools.push(pool);
    beams.push({
      kind: 'spot',
      lens: { x: spotAt[i].x + l.x, y: spotAt[i].y + l.y },
      lensW: 18 * spotFx[i].scale,
      pool,
      colour,
      I,
      poolI: rig.throwFalloff(),
      soft: Math.min(0.9, 0.25 + (1 - rig.out.focus) * 0.4 + rig.out.frost * 0.45),
      gobo: rig.out.gobo,
      spin: rig.goboSpin,
    });
    lights.push({
      pool,
      I: rig.poolI,
      // Tint for the photos: mostly the beam colour, a little towards white.
      tint: rgbCss(colour.map((c) => 0.25 + 0.75 * c) as RGB),
      halo: rgbCss(colour),
      mask,
      haloMask: sp.halo,
      spin: rig.goboSpin,
      key: `${rig.out.gobo}.${sp.version}`,
    });
  });
  const floods: Flood[] = panels.map((pr, j) => {
    const colour = pr.colour();
    const l = panelFx[j].draw(pr.intensity, colour);
    beams.push({
      kind: 'panel',
      lens: { x: panelAt[j].x + l.x, y: panelAt[j].y + l.y },
      lensW: panelFx[j].lensHalfWidth,
      pool: pr.pool,
      colour,
      I: pr.intensity,
      poolI: 1,
      soft: 0.9,
      gobo: 0,
      spin: 0,
    });
    return { pool: pr.pool, I: pr.intensity, at: (x: number, y: number) => pr.at(x, y) };
  });

  let bounceFrom: { c: [number, number, number, number]; i: number; w: number } | null = null;
  for (const p of lightVisible) {
    p.drawLight(lights);
    p.spill(lights, floods);
    if (sheet.isOpen) continue;
    lights.forEach((L, i) => {
      if (L.I < 0.01) return;
      const b = p.sampleBounce(L.pool);
      if (b && (!bounceFrom || b[3] * L.I > bounceFrom.w)) bounceFrom = { c: b, i, w: b[3] * L.I };
    });
  }

  // Colour bounced off the set under the brightest pool, lit by that spot's own colour.
  const k = Math.min(1, dt * 3);
  const bf = bounceFrom as { c: [number, number, number, number]; i: number; w: number } | null;
  if (bf) {
    const col = spots[bf.i].colour();
    const pool = spotPools[bf.i];
    const snap = bounceAmt < 0.004 ? 1 : k;
    for (let c = 0; c < 3; c++) bounce[c] += (bf.c[c] * col[c] - bounce[c]) * k;
    bouncePos.x += (pool.x - bouncePos.x) * snap;
    bouncePos.y += (pool.y - bouncePos.y) * snap;
    bounceAxes.x += (pool.rx - bounceAxes.x) * snap;
    bounceAxes.y += (pool.ry - bounceAxes.y) * snap;
    bounceAmt += (0.09 * Math.min(1, lights[bf.i].I * 1.1) - bounceAmt) * k;
  } else {
    bounceAmt += (0 - bounceAmt) * k;
  }

  shaft?.render({ vw, vh, haze, time: hazeClock, beams, bounce, bounceAmt, bouncePos, bounceAxes });

  // Lit type: each spot's pool-sized core with a long faint tail, and the panels' broad fields.
  {
    const lc = [0, 0, 0];
    let wsum = 0;
    const add = (c: RGB, w: number) => {
      for (let n = 0; n < 3; n++) lc[n] += c[n] * w;
      wsum += w;
    };
    spots.forEach((r, i) => add(r.colour(), lights[i].I));
    panels.forEach((pr) => add(pr.colour(), pr.intensity * 0.6));
    const light = wsum > 0.001 ? lc.map((v) => v / wsum) : spots[0].colour();
    setVar(root, '--light', light.map((v) => Math.round(v * 255)).join(' '));
    // Each lit word gets its own copy of the light, so the rest of the page isn't restyled every frame.
    for (const [el, r] of litRects) {
      spotPools.forEach((pool, i) => {
        const n = i + 1;
        setVar(el, `--l${n}x`, `${Math.round(pool.x - r.left)}px`);
        setVar(el, `--l${n}y`, `${Math.round(pool.y - r.top)}px`);
        setVar(el, `--l${n}rx`, `${Math.round(Math.max(pool.rx, pool.ry) * 2)}px`);
        setVar(el, `--l${n}ry`, `${Math.round(Math.min(pool.rx, pool.ry) * 2)}px`);
        setVar(el, `--l${n}i`, lights[i].I.toFixed(3));
      });
      panels.forEach((pr, j) => {
        const n = j + 1;
        setVar(el, `--f${n}x`, `${Math.round(pr.pool.x - r.left)}px`);
        setVar(el, `--f${n}y`, `${Math.round(pr.pool.y - r.top)}px`);
        setVar(el, `--f${n}rx`, `${Math.round(pr.pool.rx)}px`);
        setVar(el, `--f${n}ry`, `${Math.round(pr.pool.ry)}px`);
        setVar(el, `--f${n}i`, (pr.intensity * 0.7).toFixed(3));
      });
    }
  }

  // The desk's front edge catches whichever light reaches it most.
  {
    let best = { a: 0, x: vw / 2, r: 1 };
    const consider = (pool: Pool, I: number, reachK: number, weight: number) => {
      const big = Math.max(pool.rx, pool.ry);
      const gap = deskTop - (pool.y + pool.ry);
      const a = Math.max(0, Math.min(1, 1 - gap / (big * reachK))) * I * weight;
      if (a > best.a) best = { a, x: pool.x, r: big * 2.2 };
    };
    spotPools.forEach((pool, i) => consider(pool, lights[i].I, 2.4, 1));
    panels.forEach((pr) => consider(pr.pool, pr.intensity, 1.2, 0.35));
    setVar(deskEl, '--spill-x', `${Math.round(best.x)}px`);
    setVar(deskEl, '--spill-r', `${Math.round(best.r)}px`);
    setVar(deskEl, '--spill-a', (sheet.isOpen ? 0 : best.a).toFixed(3));
  }

  deskUI.tick(dt, desk.live);
}

/* ---------------------------------------------------------------- start */

addEventListener('resize', () => layout());

function start() {
  layout();
  const wm = wordmarkPoint();
  spots.forEach((r) => r.aimNow(wm.x, wm.y));
  if (reduced) {
    root.classList.add('cue-done');
    autoFill();
  } else {
    opening = true;
    root.classList.add('cue-run');
    openStart = performance.now();
    heroPlate.progress = 0;
    [...spotFx, ...panelFx].forEach((f) => (f.progress = 0));
    spots.forEach((r, i) => r.aimNow(vw / 2 + crossOf(i) * vw * 0.05, vh * 0.62));
  }
  heroPlate.load();
  observer(([e]) => root.classList.toggle('past-hero', !e.isIntersecting), {
    rootMargin: '-40% 0px 0px 0px',
  }).observe($('#top'));
  route();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

document.fonts.ready.then(start);
// Tells the page's fallback (index.html) the script is running.
(window as unknown as { __fullerton: boolean }).__fullerton = true;

// For poking at the rig from the console while developing.
if (import.meta.env.DEV) Object.assign(window, { __rig: { spots, panels, desk, plates, shaft } });
