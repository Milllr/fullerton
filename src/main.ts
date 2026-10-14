import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import './desk/desk.css';

import { allShows, credits, hero, imageUrl, shows, type Show } from './data/shows';
import { site } from './data/site';
import { Rig } from './engine/rig';
import { Plate } from './engine/plate';
import { Shaft } from './engine/shaft';
import { Fixture } from './engine/fixture';
import { buildSprites, type GoboSprites } from './engine/gobos';
import { rgbCss } from './engine/kelvin';
import { Desk, strobeHz } from './desk/model';
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

/* Nav keys light for the section you're in. */
{
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav a')];
  const io = new IntersectionObserver(
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

/* --------------------------------------------------------------- engine */

const rig = new Rig();
rig.reducedMotion = reduced;
let sprites: GoboSprites = buildSprites(0.7, 0);
let spriteKey = '0.70|0.00';
let spriteBuilt = 0;
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
const plateBySlug = (slug: string) => plates.find((p) => p.slug === slug) ?? null;

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

/* ----------------------------------------------------------------- desk */

const desk = new Desk();
const goboIcons = sprites.pool.map((c) => {
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
  if (!c?.slug) return;
  const p = plateBySlug(c.slug);
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
let fixtureRect = new DOMRect();
/** Top edge of the desk: the part of the screen the beam can usefully reach. */
let deskTop = innerHeight;

function measureDesk() {
  deskTop = $('#desk').getBoundingClientRect().top || vh;
}

function layout() {
  vw = innerWidth;
  vh = innerHeight;
  const small = vw < 720;
  const k = small ? 0.62 : vw < 1100 ? 0.8 : 1;
  fixture.resize(k);
  // Hang the clamp on the truss: the clamp top is 118 units above the pivot.
  const trussY = ($('.truss').getBoundingClientRect().top || 16) + 7;
  fixture.canvas.style.top = `${trussY - (fixture.pivotY - 118 * k)}px`;
  // On a phone the nav takes the left, so the fixture hangs to the right.
  fixture.canvas.style.left = small ? '74%' : '50%';
  fixtureRect = fixture.canvas.getBoundingClientRect();
  const pv = fixture.pivotOnScreen();
  rig.layout(vw, vh, pv.x, pv.y);
  shaft?.resize(vw, vh, lowPower);
  plates.forEach((p) => p.resize());
  measureDesk();
}

/* ---------------------------------------------------------------- input */

let pointer: { x: number; y: number } | null = null;
let lastInput = performance.now();
const IDLE_AFTER = 6000;
/** A plate the beam is briefly committed to: keyboard focus, or a click that opens it. */
let momentary: { plate: Plate; fraction: number } | null = null;

function onInput(x: number, y: number) {
  pointer = { x, y };
  lastInput = performance.now();
  if (momentary && momentary.fraction < 0.9) momentary = null;
  if (desk.exec[3].auto) {
    desk.exec[3].level = 0;
    desk.exec[3].auto = false;
    desk.emit();
  }
}

const overControls = (t: EventTarget | null) => !!(t as Element)?.closest?.('#desk, .sheet');

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  finishOpening();
  if (overControls(e.target)) {
    // Working the desk shouldn't drag the beam over to it.
    lastInput = performance.now();
    return;
  }
  onInput(e.clientX, e.clientY);
}, { passive: true });

addEventListener('touchstart', (e) => {
  finishOpening();
  const t = e.touches[0];
  if (t && !overControls(e.target)) onInput(t.clientX, t.clientY);
  else lastInput = performance.now();
}, { passive: true });
addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (t && !overControls(e.target)) onInput(t.clientX, t.clientY);
}, { passive: true });

addEventListener('keydown', () => finishOpening());

// Keyboard focus on a plate swings the beam onto it.
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

function route() {
  const m = location.hash.match(/^#\/work\/([\w-]+)$/);
  const s = m && allShows.find((x) => x.slug === m[1]);
  if (s) {
    if (!sheet.isOpen) sheet.open(s, document.querySelector<HTMLElement>(`.plate[data-slug="${s.slug}"]`));
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
    momentary = { plate: p, fraction: 0.95 };
    setTimeout(openIt, 520);
  } else openIt();
});

/* ------------------------------------------------- opening cue and lamp */

let opening = false;
let openStart = performance.now();
/** When the lamp last struck; drives the flicker. */
let strikeAt = -1e9;
let lampOn = true;
let resetUntil = 0;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Lamp level after a strike: a couple of flickers, then a slow fade up. */
function strikeLevel(now: number) {
  if (!lampOn) return 0;
  const s = now - strikeAt;
  if (s < 0) return 0;
  if (s < 60) return 0.55;
  if (s < 140) return 0.08;
  if (s < 200) return 0.7;
  if (s < 300) return 0.25;
  return 0.25 + 0.75 * ease((s - 300) / 1100);
}

desk.onLamp = (on) => {
  if (on && !lampOn) strikeAt = performance.now();
  lampOn = on;
};
desk.onReset = () => {
  resetUntil = performance.now() + 1500;
};

function finishOpening() {
  if (!opening) return;
  opening = false;
  root.classList.add('cue-done');
  fixture.progress = 1;
  heroPlate.renderSketch(1);
  strikeAt = -1e9;
}

function runOpening(now: number) {
  const t = now - openStart;
  fixture.progress = ease((t - 150) / 900);
  if (heroPlate.data) heroPlate.renderSketch(ease((t - 500) / 1700));
  if (t > 3600) finishOpening();
}

/* ---------------------------------------------------------------- frame */

let last = performance.now();
let clock = 0;
let hazeClock = 0;
let phaserClock = 0;
let sweepShown = 0;
let zoomGoal = 0;
const bounce: [number, number, number] = [0, 0, 0];
let bounceAmt = 0;
const deskEl = $('#desk');

function wordmarkPoint() {
  const wm = $('#wordmark').getBoundingClientRect();
  return { x: wm.left + wm.width * 0.42, y: wm.top + wm.height * 0.5 };
}

function zoomToCover(p: Plate, fraction: number) {
  const r = p.stage.getBoundingClientRect();
  const want = Math.min(r.width, r.height) * fraction;
  const pool = rig.pool();
  const base = rig.baseZoom();
  const dist = pool.ry / (0.25 + 0.75 * rig.out.iris) / Math.tan(((base + rig.zoomBoost) / 2) * (Math.PI / 180));
  const deg = 2 * Math.atan(want / Math.max(1, dist)) * (180 / Math.PI);
  return Math.max(0, Math.min(60, deg - base));
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!reduced) clock += dt;

  if (opening) runOpening(now);

  // Resolve the fixture's output from the desk.
  const v = (a: Parameters<Desk['value']>[1]) => desk.value(1, a).v;
  rig.out.zoom = v('zoom');
  rig.out.iris = v('iris') / 100;
  rig.out.cct = v('cct');
  rig.out.gobo = Math.round(v('gobo'));
  rig.out.goboRot = v('goboRot') / 100;
  rig.out.focus = v('focus') / 100;
  rig.out.frost = v('frost') / 100;
  rig.out.haze = desk.value(2, 'haze').v / 100;
  rig.out.fan = desk.value(2, 'fan').v / 100;
  const key = `${rig.out.focus.toFixed(2)}|${rig.out.frost.toFixed(2)}`;
  if (key !== spriteKey && now - spriteBuilt > 90) {
    sprites = buildSprites(rig.out.focus, rig.out.frost);
    spriteKey = key;
    spriteBuilt = now;
  }

  // Intensity: dimmer, Grand Master, B.O., lamp strike, strobe.
  const shutter = v('shutter');
  const strobe = shutter >= 0.5 && !reduced ? ((clock * strobeHz(shutter)) % 1 < 0.5 ? 1 : 0) : 1;
  const lamp = opening ? strikeLevelOpening(now) : strikeLevel(now);
  rig.intensity = sheet.isOpen ? 0 : desk.intensity() * lamp * strobe;

  // Where the head should point.
  const pos = desk.position();
  let target = pointer ?? wordmarkPoint();
  let cover: { plate: Plate; fraction: number } | null = null;
  if (momentary) {
    cover = momentary;
  } else if (pos.kind === 'plate') {
    const p = plateBySlug(pos.slug);
    if (p) cover = { plate: p, fraction: 0.46 };
  } else if (pos.kind === 'angles') {
    target = rig.pointFor(pos.pan, pos.tilt);
  }
  if (cover) {
    const r = cover.plate.stage.getBoundingClientRect();
    target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (now < resetUntil) target = rig.pointFor(0, 6);

  // Executor 3: a pan and tilt sweep phaser. It also comes up by itself when nobody's touching anything.
  if (!opening && pos.kind === 'follow' && !momentary && now - lastInput > IDLE_AFTER && !sheet.isOpen && !reduced && desk.exec[3].level === 0 && !desk.exec[3].flash) {
    desk.exec[3].level = 0.55;
    desk.exec[3].auto = true;
    desk.emit();
  }
  sweepShown += (desk.sweepSize() - sweepShown) * Math.min(1, dt * 1.5);
  if (sweepShown > 0.005 && !reduced) {
    phaserClock += dt;
    const free = pos.kind === 'follow' && !momentary;
    const usable = Math.min(vh, deskTop);
    const base = free ? { x: vw / 2, y: usable * 0.58 } : target;
    const ax = (free ? vw * 0.3 : vw * 0.12) * sweepShown;
    const ay = (free ? usable * 0.2 : usable * 0.08) * sweepShown;
    const blend = free ? Math.min(1, sweepShown / 0.25) : 1;
    const sx = base.x + ax * Math.sin((TAU * phaserClock) / 24);
    const sy = base.y + ay * Math.sin((TAU * phaserClock) / 16 + 0.9);
    target = { x: target.x + (sx - target.x) * blend, y: target.y + (sy - target.y) * blend };
  }
  rig.target = target;

  // Cue fade times set how heavily the head moves.
  const cue = desk.currentCue();
  rig.omega = pos.kind !== 'follow' && pos.from === 'cue' && cue ? Math.max(2.5, Math.min(8, 15 / cue.fade)) : 5.2;
  const hold = desk.exec[1].paused && pos.kind !== 'follow' && pos.from === 'cue';

  zoomGoal = cover && desk.value(1, 'zoom').src !== 'programmer' ? zoomToCover(cover.plate, cover.fraction) : 0;
  rig.zoomBoost += (zoomGoal - rig.zoomBoost) * Math.min(1, dt * 4);
  rig.update(dt, hold);
  desk.live = rig.degrees();

  hazeClock += dt * (0.25 + rig.out.fan * 1.75) * (reduced ? 0 : 1);

  const pool = rig.pool();
  const colour = rig.colour();
  const I = rig.intensity;
  rig.poolI = I * rig.throwFalloff();
  const lensLocal = fixture.draw(rig.pan, rig.tilt, I, colour);
  const lens = { x: fixtureRect.left + lensLocal.x, y: fixtureRect.top + lensLocal.y };
  const soft = Math.min(0.9, 0.25 + (1 - rig.out.focus) * 0.4 + rig.out.frost * 0.45);

  // Tint for the photos: mostly the beam colour, a little towards white.
  const tint = rgbCss(colour.map((c) => 0.25 + 0.75 * c) as [number, number, number]);
  const halo = rgbCss(colour);
  const lightVisible = plates.filter((p) => p.visible);
  for (const p of lightVisible) p.measure();
  let bounceTarget: [number, number, number, number] | null = null;
  for (const p of lightVisible) {
    if (sheet.isOpen) {
      p.clearLight();
      p.spill(pool, 0);
      continue;
    }
    p.drawLight(pool, rig, sprites, tint, halo);
    p.spill(pool, rig.poolI);
    const b = p.sampleBounce(pool);
    if (b && (!bounceTarget || b[3] > bounceTarget[3])) bounceTarget = b;
  }

  // Colour bounced off the set the pool is sitting on, lit by the beam's own colour.
  const k = Math.min(1, dt * 3);
  if (bounceTarget) {
    for (let i = 0; i < 3; i++) bounce[i] += (bounceTarget[i] * colour[i] - bounce[i]) * k;
    bounceAmt += (0.09 - bounceAmt) * k;
  } else {
    bounceAmt += (0 - bounceAmt) * k;
  }

  shaft?.setGobo(sprites.pool[rig.out.gobo]);
  shaft?.render({
    vw, vh, lens, pool, colour,
    dim: I, poolI: rig.throwFalloff(), haze: rig.out.haze, time: hazeClock, gobo: rig.out.gobo, spin: rig.goboSpin, soft,
    bounce, bounceAmt,
  });

  // Lit type: a pool-sized core with a long, faint tail.
  root.style.setProperty('--light', `${Math.round(colour[0] * 255)} ${Math.round(colour[1] * 255)} ${Math.round(colour[2] * 255)}`);
  root.style.setProperty('--lrx', `${Math.round(Math.max(pool.rx, pool.ry) * 2)}px`);
  root.style.setProperty('--lry', `${Math.round(Math.min(pool.rx, pool.ry) * 2)}px`);
  root.style.setProperty('--li', rig.poolI.toFixed(3));
  const rects = [...litVisible].map((el) => [el, el.getBoundingClientRect()] as const);
  for (const [el, r] of rects) {
    el.style.setProperty('--lx', `${Math.round(pool.x - r.left)}px`);
    el.style.setProperty('--ly', `${Math.round(pool.y - r.top)}px`);
  }

  // The desk's front edge catches the beam when it lands low on the page.
  {
    const reach = Math.max(pool.rx, pool.ry) * 2.4;
    const gap = deskTop - (pool.y + pool.ry);
    const a = sheet.isOpen ? 0 : Math.max(0, Math.min(1, 1 - gap / reach)) * rig.poolI;
    deskEl.style.setProperty('--spill-x', `${Math.round(pool.x)}px`);
    deskEl.style.setProperty('--spill-r', `${Math.round(Math.max(pool.rx, pool.ry) * 2.2)}px`);
    deskEl.style.setProperty('--spill-a', a.toFixed(3));
  }

  deskUI.tick(dt, desk.live);
  requestAnimationFrame(frame);
}

/** The opening cue's own strike, timed against the page load. */
function strikeLevelOpening(now: number) {
  const s = now - openStart - 1900;
  if (s < 0) return 0;
  if (s < 60) return 0.55;
  if (s < 140) return 0.08;
  if (s < 200) return 0.7;
  if (s < 300) return 0.25;
  return 0.25 + 0.75 * ease((s - 300) / 1100);
}

/* ---------------------------------------------------------------- start */

addEventListener('resize', () => layout());

function start() {
  layout();
  const wm = wordmarkPoint();
  rig.aimNow(wm.x, wm.y);
  if (reduced) {
    root.classList.add('cue-done');
  } else {
    opening = true;
    root.classList.add('cue-run');
    openStart = performance.now();
    heroPlate.progress = 0;
    fixture.progress = 0;
    rig.aimNow(vw / 2, vh * 0.62);
  }
  heroPlate.load();
  new IntersectionObserver(([e]) => root.classList.toggle('past-hero', !e.isIntersecting), {
    rootMargin: '-40% 0px 0px 0px',
  }).observe($('#top'));
  route();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

document.fonts.ready.then(start);
