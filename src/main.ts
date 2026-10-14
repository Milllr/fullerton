import '@fontsource-variable/archivo/wdth.css';
import './styles.css';

import { allShows, credits, hero, imageUrl, shows, type Show } from './data/shows';
import { site } from './data/site';
import { Rig, type Settings } from './engine/rig';
import { Plate } from './engine/plate';
import { Shaft } from './engine/shaft';
import { Fixture } from './engine/fixture';
import { buildSprites } from './engine/gobos';
import { rgbCss } from './engine/kelvin';
import { Desk } from './ui/console';
import { renderCredits } from './ui/credits';
import { Sheet } from './ui/detail';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const root = document.documentElement;

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
    (s, i) => `<article class="show show-${i + 1}">
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
  if (site.phone) lines.push(`<a class="contact-line lit" href="tel:${esc(site.phone.replace(/[^+\d]/g, ''))}"><span class="lit-line">${esc(site.phone)}</span></a>`);
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

/* Lit type: an outlined word with a filled copy that only shows under the beam. */
const litEls = [...document.querySelectorAll<HTMLElement>('.lit')];
for (const el of litEls) {
  const fill = document.createElement('span');
  fill.className = 'lit-fill';
  fill.setAttribute('aria-hidden', 'true');
  fill.innerHTML = el.innerHTML;
  el.append(fill);
}

/* --------------------------------------------------------------- engine */

const rig = new Rig();
rig.reducedMotion = reduced;
const sprites = buildSprites();
const fixture = new Fixture($<HTMLCanvasElement>('#fixture'));
const shaft = Shaft.create($<HTMLCanvasElement>('#shaft'));
if (!shaft) root.classList.add('no-shaft');

const plates: Plate[] = [];
const heroPlate = new Plate($('.plate-hero'), hero.slug, hero.images.find((i) => i.id === hero.key)!, 0.55, 0.8);
plates.push(heroPlate);
document.querySelectorAll<HTMLElement>('#plates .plate').forEach((el, i) => {
  const s = shows[i];
  plates.push(new Plate(el, s.slug, s.images.find((im) => im.id === s.key)!));
});
const cues = plates; // Go steps through the plates in page order.

const near = new IntersectionObserver(
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
const seen = new IntersectionObserver(
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

const litVisible = new Set<HTMLElement>();
const litSeen = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const el = e.target as HTMLElement;
    if (e.isIntersecting) litVisible.add(el);
    else litVisible.delete(el);
  }
});
litEls.forEach((el) => litSeen.observe(el));

let vw = innerWidth, vh = innerHeight;
let lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;
const TRUSS_Y = 23; // centre line of the truss, css px
let fixtureRect = new DOMRect();

function layout() {
  vw = innerWidth;
  vh = innerHeight;
  const small = vw < 720;
  const k = small ? 0.62 : vw < 1100 ? 0.8 : 1;
  fixture.resize(k);
  // Hang the clamp on the truss: the clamp top is 118 units above the pivot.
  const top = TRUSS_Y - (fixture.pivotY - 118 * k);
  fixture.canvas.style.top = `${top}px`;
  // On a phone the nav takes the left, so the fixture hangs to the right.
  fixture.canvas.style.left = small ? '74%' : '50%';
  fixtureRect = fixture.canvas.getBoundingClientRect();
  const pv = fixture.pivotOnScreen();
  rig.layout(vw, vh, pv.x, pv.y);
  shaft?.resize(vw, vh, lowPower);
  plates.forEach((p) => p.resize());
}

/* ---------------------------------------------------------------- input */

let lastInput = performance.now();
let cueIndex = 0;
let cuePlate: Plate | null = null;
let zoomGoal = 0;
const IDLE_AFTER = 6000;

function follow(x: number, y: number) {
  if (rig.mode === 'cue') {
    // Big moves take the beam back from a running cue.
    if (Math.hypot(x - rig.target.x, y - rig.target.y) < 40) return;
    cuePlate = null;
    zoomGoal = 0;
  }
  rig.mode = 'follow';
  rig.target.x = x;
  rig.target.y = y;
  lastInput = performance.now();
}

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  finishOpening();
  // Working the console shouldn't drag the beam over to it.
  if ((e.target as Element).closest?.('#desk')) {
    lastInput = performance.now();
    return;
  }
  follow(e.clientX, e.clientY);
}, { passive: true });

addEventListener('touchstart', (e) => {
  finishOpening();
  const t = e.touches[0];
  if (t) follow(t.clientX, t.clientY);
}, { passive: true });
addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (t) follow(t.clientX, t.clientY);
}, { passive: true });

addEventListener('keydown', (e) => {
  finishOpening();
  if (e.target instanceof HTMLInputElement || sheet.isOpen) return;
  if (e.key === 'g' || e.key === 'G') go(e.shiftKey ? -1 : 1);
});

// Keyboard focus on a plate swings the beam onto it.
document.addEventListener('focusin', (e) => {
  const el = (e.target as HTMLElement).closest?.('.plate');
  const p = el && plates.find((pl) => pl.el === el);
  if (p) cueTo(p, 0.3);
});

function zoomToCover(p: Plate, fraction: number) {
  const r = p.stage.getBoundingClientRect();
  const want = Math.min(r.width, r.height) * fraction;
  const pool = rig.pool();
  const base = rig.settings.zoom * rig.zoomScale;
  const dist = pool.ry / Math.tan(((base + rig.zoomBoost) / 2) * (Math.PI / 180));
  const deg = 2 * Math.atan(want / Math.max(1, dist)) * (180 / Math.PI);
  return Math.max(0, Math.min(60, deg - base));
}

function cueTo(p: Plate, fraction = 0.46) {
  cuePlate = p;
  rig.mode = 'cue';
  zoomGoal = zoomToCover(p, fraction);
  lastInput = performance.now();
  const i = cues.indexOf(p);
  if (i >= 0) {
    cueIndex = i;
    const s = allShows.find((x) => x.slug === p.slug)!;
    desk.setCue(i + 1, s.title);
  }
}

function go(dir: 1 | -1) {
  finishOpening();
  const next = cuePlate ? cueIndex + dir : dir === 1 ? cueIndexNearest() : cueIndexNearest() - 1;
  const i = (next + cues.length) % cues.length;
  const p = cues[i];
  p.el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  cueTo(p);
}

function cueIndexNearest() {
  let best = 0, bestD = Infinity;
  cues.forEach((p, i) => {
    const r = p.stage.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - vh / 2);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/* ---------------------------------------------------------------- desk */

const goboIcons = sprites.pool.map((c) => {
  const t = document.createElement('canvas');
  t.width = t.height = 44;
  const x = t.getContext('2d')!;
  x.fillStyle = '#000';
  x.beginPath();
  x.arc(22, 22, 22, 0, Math.PI * 2);
  x.fill();
  x.drawImage(c, 0, 0, 44, 44);
  return t.toDataURL();
});
const desk = new Desk(
  $('#desk'),
  rig.settings,
  goboIcons,
  {
    change: (s: Partial<Settings>) => Object.assign(rig.settings, s),
    go,
  },
  !coarse && vw >= 900,
);
desk.setCue(1, hero.title);
let deskTouched = false;
$('#desk').addEventListener('pointerdown', () => (deskTouched = true));
$('#desk').addEventListener('keydown', () => (deskTouched = true));

/* ---------------------------------------------------------------- sheet */

const sheet = new Sheet($('#sheet'), reduced);
let openedFromPage = false;
sheet.onClose = () => {
  if (openedFromPage) history.back();
  else history.replaceState(null, '', location.pathname + location.search);
  sheet.close();
};

function route() {
  const m = location.hash.match(/^#\/work\/([\w-]+)$/);
  const s = m && allShows.find((x) => x.slug === m[1]);
  if (s) {
    if (!sheet.isOpen) {
      const from = document.querySelector<HTMLElement>(`.plate[data-slug="${s.slug}"]`);
      sheet.open(s, from);
    }
  } else if (sheet.isOpen) {
    sheet.close();
  }
}
addEventListener('hashchange', route);

// Opening a show: swing onto the plate and open the beam wide, then the sheet.
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#/work/"]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  const slug = a.getAttribute('href')!.slice(7);
  const p = plates.find((pl) => pl.slug === slug && pl.visible);
  const openIt = () => {
    openedFromPage = true;
    location.hash = `#/work/${slug}`;
  };
  if (p && !reduced) {
    cueTo(p, 0.95);
    setTimeout(openIt, 520);
  } else openIt();
});

/* ---------------------------------------------------------- opening cue */

let opening = false;
let openStart = performance.now();
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function finishOpening() {
  if (!opening) return;
  opening = false;
  root.classList.add('cue-done');
  fixture.progress = 1;
  heroPlate.renderSketch(1);
  rig.level = 1;
}

function runOpening(now: number) {
  const t = now - openStart;
  fixture.progress = ease((t - 150) / 900);
  if (heroPlate.data) heroPlate.renderSketch(ease((t - 500) / 1700));
  // Lamp strike: a couple of flickers, then a slow fade up.
  const s = t - 1900;
  if (s < 0) rig.level = 0;
  else if (s < 60) rig.level = 0.55;
  else if (s < 140) rig.level = 0.08;
  else if (s < 200) rig.level = 0.7;
  else if (s < 300) rig.level = 0.25;
  else rig.level = 0.25 + 0.75 * ease((s - 300) / 1100);
  if (s > 300 && rig.mode === 'rest') {
    const wm = $('#wordmark').getBoundingClientRect();
    rig.target.x = wm.left + wm.width * 0.42;
    rig.target.y = wm.top + wm.height * 0.5;
  }
  if (t > 3600) finishOpening();
}

/* ---------------------------------------------------------------- frame */

let last = performance.now();
let clock = 0;

function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (!reduced) clock += dt;

  if (opening) runOpening(now);
  if (!opening && rig.mode !== 'idle' && now - lastInput > IDLE_AFTER && !sheet.isOpen && !reduced) {
    rig.mode = 'idle';
    cuePlate = null;
    zoomGoal = 0;
  }
  if (rig.mode === 'cue' && cuePlate) {
    const r = cuePlate.stage.getBoundingClientRect();
    rig.target.x = r.left + r.width / 2;
    rig.target.y = r.top + r.height / 2;
  }
  rig.zoomBoost += (zoomGoal - rig.zoomBoost) * Math.min(1, dt * 4);
  rig.update(dt, vw, vh);

  const pool = rig.pool();
  const colour = rig.colour();
  const I = sheet.isOpen ? 0 : rig.intensity();
  const lensLocal = fixture.draw(rig.pan, rig.tilt, I, colour);
  const lens = { x: fixtureRect.left + lensLocal.x, y: fixtureRect.top + lensLocal.y };

  shaft?.render({
    vw, vh, lens, pool, colour,
    dim: I, haze: rig.settings.haze, time: clock, gobo: rig.settings.gobo, spin: rig.goboSpin,
  });

  // Tint for the photos: mostly the beam colour, a little towards white.
  const tintRgb = colour.map((c) => 0.25 + 0.75 * c) as [number, number, number];
  const tint = rgbCss(tintRgb);
  const halo = rgbCss(colour);
  const lightVisible = plates.filter((p) => p.visible);
  for (const p of lightVisible) p.measure();
  for (const p of lightVisible) {
    // The page behind an open sheet stays dark.
    if (sheet.isOpen) p.clearLight();
    else p.drawLight(pool, rig, sprites, tint, halo);
  }

  // Lit type.
  root.style.setProperty('--light', `${Math.round(colour[0] * 255)} ${Math.round(colour[1] * 255)} ${Math.round(colour[2] * 255)}`);
  root.style.setProperty('--lrx', `${Math.round(Math.max(pool.rx, pool.ry) * 1.15)}px`);
  root.style.setProperty('--lry', `${Math.round(Math.min(pool.rx, pool.ry) * 1.15)}px`);
  root.style.setProperty('--li', I.toFixed(3));
  const rects = [...litVisible].map((el) => [el, el.getBoundingClientRect()] as const);
  for (const [el, r] of rects) {
    el.style.setProperty('--lx', `${Math.round(pool.x - r.left)}px`);
    el.style.setProperty('--ly', `${Math.round(pool.y - r.top)}px`);
  }

  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------- start */

addEventListener('resize', () => {
  layout();
});

function start() {
  layout();
  // Start pointed at the middle of the hero, below the wordmark.
  rig.aimNow(vw / 2, vh * 0.62);
  rig.mode = 'rest';
  if (reduced) {
    rig.level = 1;
    root.classList.add('cue-done');
    const wm = $('#wordmark').getBoundingClientRect();
    rig.aimNow(wm.left + wm.width * 0.42, wm.top + wm.height / 2);
  } else {
    opening = true;
    root.classList.add('cue-run');
    openStart = performance.now();
    heroPlate.progress = 0;
    fixture.progress = 0;
  }
  heroPlate.load();
  new IntersectionObserver(
    ([e]) => {
      root.classList.toggle('past-hero', !e.isIntersecting);
      if (!e.isIntersecting && !deskTouched) desk.setOpen(false);
    },
    { rootMargin: '-40% 0px 0px 0px' },
  ).observe($('#top'));
  route();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

document.fonts.ready.then(start);
