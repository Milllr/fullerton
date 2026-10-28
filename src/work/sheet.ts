import { imageUrl, type Film, type Show, type ShowImage } from '../data/shows';
import { clamp, esc, setText, setVar, Spring } from '../lib/dom';
import { CELL, type Warmth } from '../light/warmth';

/*
  A show, opened. Its photo fills the window behind a sheet of frost that
  covers part of it (the type sits on the frost), its edge leaning a little
  towards the pointer. Click the left of the window to go back, anywhere
  else to go on; the pointer turns into a quiet arrow showing which. On a
  phone, swipe sideways between photos, tap to go on, and drag up or down
  to move the frost edge. Each photo
  dissolves in over the one before, which stays until the new one is
  fully there, so there's no dip and nothing flashes. The
  numbers along the bottom step through the photos. And the warmth that
  follows the pointer (or a finger) melts the frost: the photo shows
  through wherever it's been, and frosts over again as it cools.

  A show with a film has it after the photos: a photo of the show with a
  hairline play mark, whole and clear of the frost, and the player (from
  YouTube) only loads when it's played. Moving on stops it.
*/

const pad = (n: number) => String(n).padStart(2, '0');

interface Slide {
  el: HTMLElement;
  /** How far it has dissolved in, 0..1. */
  t: number;
  im: ShowImage;
  img: HTMLImageElement;
  melt: HTMLCanvasElement;
  box: { l: number; t: number; w: number; h: number };
  /** The film this slide stands for, if it isn't a photo. */
  film?: Film;
}

const PLAY = `<svg class="sh-play" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#f2ede4" stroke-width="1.2" stroke-linejoin="round"><circle cx="32" cy="32" r="30"/><path d="M26 21.5v21l17-10.5z"/></g></svg>`;

export class Sheet {
  private show: Show | null = null;
  private index = 0;
  private slides: Slide[] = [];
  private returnFocus: HTMLElement | null = null;
  private edge = new Spring(1, 0.8, 0.92);
  /** Where the edge has been left (null: its own resting place), and how far the pointer leans it. */
  private rest: number | null = null;
  private lean = 0;
  private dragging = false;
  private closing: number | null = null;
  private token = 0;
  onClose: () => void = () => {};

  constructor(
    private root: HTMLElement,
    private reduced: boolean,
  ) {
    root.tabIndex = -1;
    document.fonts?.ready.then(() => (this.typeKey = ''));
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') this.onClose();
      else if (e.key === 'ArrowRight') this.step(1);
      else if (e.key === 'ArrowLeft') this.step(-1);
      else if (e.key === 'Tab') this.trap(e);
    });
  }

  get isOpen() {
    return !this.root.hidden && this.closing == null;
  }

  /** The phone layout (frost across the top, edge moving up and down), the same query as the stylesheet's. */
  private tall = matchMedia('(max-width: 699px), (orientation: portrait) and (max-width: 1000px)');
  private get portrait() {
    return this.tall.matches;
  }

  /** Everything behind the sheet, inert while it's open so Tab and screen readers stay in it. */
  private background() {
    return [...document.body.children].filter(
      (el): el is HTMLElement => el !== this.root && el instanceof HTMLElement && el.tagName !== 'SCRIPT',
    );
  }

  open(show: Show, number: number, from?: HTMLElement | null) {
    if (this.closing != null) {
      clearTimeout(this.closing);
      this.closing = null;
    }
    this.show = show;
    this.returnFocus = from ?? null;
    for (const el of this.background()) el.inert = true;
    const years = show.year ? show.year.split(' to ') : [];
    const meta: [string, string][] = [];
    if (show.network) meta.push(['Network', esc(show.network)]);
    meta.push(['Kind', esc(show.kind)]);
    if (show.film)
      meta.push(['Video', `<button class="sh-watch" type="button">Watch<span class="sh-len">${esc(show.film.length)}</span></button>`]);
    this.root.innerHTML = `
      <div class="sh-slides"></div>
      <div class="sh-type">
        <p class="sh-top"><span class="sh-no">${pad(number)}</span><button class="sh-close" type="button">Close</button></p>
        <h2 class="sh-title" id="sheet-title">${esc(show.title)}</h2>
        <dl class="sh-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        ${show.note ? `<p class="sh-note">${esc(show.note.text)}${show.note.source ? ` <a href="${show.note.source.url}" target="_blank" rel="noopener">${esc(show.note.source.label)}<span aria-hidden="true"> ↗</span></a>` : ''}</p>` : ''}
        ${years.length ? `<p class="sh-year">${years.map((y) => `<span>${esc(y)}</span>`).join('')}</p>` : ''}
        <div class="sh-foot">
          ${
            this.count > 1
              ? `<nav class="sh-strip" aria-label="Photos">${show.images
                  .map((_, i) => `<button type="button" data-i="${i}" aria-label="Photo ${i + 1} of ${show.images.length}">${i + 1}</button>`)
                  .join('')}${show.film ? `<button type="button" data-i="${show.images.length}">Video</button>` : ''}</nav>`
              : ''
          }
          <p class="sh-count" aria-live="polite"></p>
          <p class="sh-credit"></p>
        </div>
      </div>`;
    this.unbind?.abort();
    this.unbind = new AbortController();
    this.dragging = false;
    this.root.querySelector('.sh-close')!.addEventListener('click', () => this.onClose());
    this.root.querySelector('.sh-watch')?.addEventListener('click', () => this.watch());
    this.root.querySelectorAll<HTMLButtonElement>('.sh-strip button').forEach((b) =>
      b.addEventListener('click', () => this.go(Number(b.dataset.i))),
    );
    this.bindEdge();
    this.slides = [];
    this.root.hidden = false;
    document.documentElement.classList.add('sheet-open');
    // The frost starts over the whole photo and draws back to its edge.
    this.edge.set(1);
    this.rest = null;
    this.lean = 0;
    requestAnimationFrame(() => this.root.classList.add('is-open'));
    this.go(this.first(show));
    // The sheet itself takes focus, so the keys work and Tab comes to Close next, with no ring drawn round Close as it opens.
    this.root.focus({ preventScroll: true });
  }

  /** Open on the photo the showcase had in front. */
  private first(show: Show) {
    return Math.max(0, show.images.findIndex((im) => im.id === show.key));
  }

  /** The show that's open, if any. */
  get slug() {
    return this.isOpen ? this.show?.slug ?? null : null;
  }

  /** How many there are to step through: the photos, and the film if there is one. */
  private get count() {
    return this.show ? this.show.images.length + (this.show.film ? 1 : 0) : 0;
  }

  close() {
    if (this.root.hidden || this.closing != null) return;
    this.stopFilm();
    this.unbind?.abort();
    this.unbind = null;
    this.dragging = false;
    this.root.classList.remove('is-open');
    document.documentElement.classList.remove('sheet-open');
    for (const el of this.background()) el.inert = false;
    const done = () => {
      this.closing = null;
      this.root.hidden = true;
      this.root.innerHTML = '';
      this.show = null;
      this.slides = [];
    };
    if (this.reduced) done();
    else this.closing = window.setTimeout(done, 650);
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur?.();
    this.returnFocus = null;
  }

  /** Listeners on the sheet itself, which outlives each show: they go when the show closes. */
  private unbind: AbortController | null = null;

  private bindEdge() {
    const r = this.root;
    const signal = this.unbind!.signal;
    const along = (e: PointerEvent) => (this.portrait ? e.clientY / innerHeight : e.clientX / innerWidth);
    const slides = r.querySelector<HTMLElement>('.sh-slides')!;
    const many = () => this.count > 1;
    /** Which way a click here goes: the left part of the window back, the rest on. */
    const way = (e: PointerEvent) => (e.clientX < innerWidth * 0.33 ? -1 : 1);
    let down: { x: number; y: number; t: number; at: number } | null = null;
    // On a phone a sideways swipe moves between photos; up and down moves the frost edge.
    let swipe = false;
    r.addEventListener(
      'pointermove',
      (e) => {
        if (down && e.pointerType !== 'mouse') {
          const dx = e.clientX - down.x;
          const dy = e.clientY - down.y;
          if (!this.dragging && !swipe && Math.hypot(dx, dy) > 8) {
            if (this.portrait && Math.abs(dx) > Math.abs(dy) * 1.2) swipe = true;
            else if (this.portrait) this.dragging = true;
          }
          if (this.dragging) this.rest = along(e) + down.at;
        } else if (e.pointerType === 'mouse') {
          this.lean = along(e) - 0.5;
          // The pointer turns into a quiet arrow showing which way a click goes, or a play mark over a film.
          const free = !(e.target as HTMLElement).closest('a, button');
          const go = free && this.onFilm(e) ? 'play' : free && many() ? (way(e) < 0 ? 'prev' : 'next') : '';
          if (slides.dataset.go !== go) slides.dataset.go = go;
        }
      },
      { signal },
    );
    r.addEventListener(
      'pointerleave',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        this.lean = 0;
        slides.dataset.go = '';
      },
      { signal },
    );
    slides.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), at: this.edge.x - along(e) };
      swipe = false;
      slides.setPointerCapture(e.pointerId);
    });
    const up = (e: PointerEvent) => {
      const was = down;
      down = null;
      if (swipe) {
        swipe = false;
        if (was && e.type === 'pointerup' && Math.abs(e.clientX - was.x) > 40) this.step(e.clientX < was.x ? 1 : -1);
        return;
      }
      if (this.dragging) {
        this.dragging = false;
        return;
      }
      if (!was || e.type !== 'pointerup' || performance.now() - was.t > 450) return;
      // A click goes back on the left and on everywhere else; a tap on a phone goes on. On a film, either plays it.
      if (this.onFilm(e)) this.play();
      else if (e.pointerType === 'mouse') this.step(way(e));
      else this.step(1);
    };
    slides.addEventListener('pointerup', up);
    slides.addEventListener('pointercancel', up);
    slides.addEventListener('lostpointercapture', (e) => down && up(e));
  }

  private step(d: number) {
    if (!this.show) return;
    const n = this.count;
    if (n > 1) this.go((this.index + d + n) % n);
  }

  /** Go to the film and play it. */
  private watch() {
    const at = this.show?.images.length ?? 0;
    if (this.index === at && this.slides[this.slides.length - 1]?.film) this.play();
    else this.go(at, true);
  }

  /** Whether the pointer is on the film, waiting to be played. */
  private onFilm(e: PointerEvent) {
    const s = this.slides[this.slides.length - 1];
    if (!s?.film || this.index !== this.show?.images.length || s.el.classList.contains('is-playing')) return false;
    const b = s.box;
    return e.clientX >= b.l && e.clientX <= b.l + b.w && e.clientY >= b.t && e.clientY <= b.t + b.h;
  }

  /** The player loads only now, over the film's photo. */
  private play() {
    const s = this.slides[this.slides.length - 1];
    const film = s?.film;
    if (!film || s.el.classList.contains('is-playing')) return;
    const f = document.createElement('iframe');
    f.className = 'sh-video';
    f.title = film.title;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.src = `https://www.youtube-nocookie.com/embed/${film.youtube}?autoplay=1&rel=0&playsinline=1`;
    s.el.querySelector('.sh-clear')!.append(f);
    s.el.classList.add('is-playing');
    this.root.querySelector<HTMLElement>('.sh-slides')!.dataset.go = '';
    f.focus();
  }

  /** Stop the film: its player goes, and its photo is back. */
  private stopFilm() {
    for (const el of this.root.querySelectorAll('.is-playing')) {
      el.querySelector('.sh-video')?.remove();
      el.classList.remove('is-playing');
    }
  }

  private async go(i: number, play = false) {
    const show = this.show;
    if (!show) return;
    this.stopFilm();
    this.index = i;
    const token = ++this.token;
    const film = i === show.images.length ? show.film : undefined;
    const im = film ? show.images.find((m) => m.id === film.poster) ?? show.images[0] : show.images[i];
    const n = this.count;
    setText(this.root.querySelector('.sh-count')!, n > 1 ? `${pad(i + 1)} / ${pad(n)}` : '');
    setText(this.root.querySelector('.sh-credit')!, film ? `Video ${film.by}` : im.credit ? `Photo ${im.credit}` : '');
    // The credit line can change the type's size; measure it again.
    this.typeKey = '';
    this.root.querySelectorAll('.sh-strip button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    const el = document.createElement('figure');
    el.className = film ? 'sh-slide is-film' : 'sh-slide';
    const full = imageUrl(show.slug, im.id, 'full');
    const m = imageUrl(show.slug, im.id, 'm');
    const alt = film ? `${show.title}, video` : `${show.title}, photo ${i + 1} of ${show.images.length}`;
    el.innerHTML = `
      <img class="sh-back" src="${m}" alt="" />
      <div class="sh-box">
        <img class="sh-frost" src="${m}" alt="" />
        <canvas class="sh-melt" aria-hidden="true"></canvas>
        <div class="sh-clear"><img class="sh-img" alt="${esc(alt)}" /><i class="sh-tint"></i>${film ? PLAY : ''}</div>
      </div>`;
    const img = el.querySelector<HTMLImageElement>('.sh-img')!;
    img.src = full;
    // Every layer ready before it starts to show, so nothing pops in partway through the dissolve.
    await Promise.all([...el.querySelectorAll('img')].map((im) => im.decode().catch(() => {})));
    if (token !== this.token || this.show !== show) return;
    this.root.querySelector('.sh-slides')!.append(el);
    // The photos either side, fetched now so a click changes photo at once.
    const idAt = (j: number) => (j === show.images.length ? show.film!.poster : show.images[j].id);
    for (const d of [1, -1])
      for (const size of ['full', 'm'] as const) new Image().src = imageUrl(show.slug, idAt((i + d + n) % n), size);
    this.slides.push({ el, t: this.reduced ? 1 : 0, im, img, melt: el.querySelector('canvas')!, box: { l: 0, t: 0, w: 0, h: 0 }, film });
    if (play) this.play();
  }

  /** The warmth the pointer leaves, which melts the frost. */
  warmth: Warmth | null = null;
  private heatCanvas = document.createElement('canvas');
  private heatData: ImageData | null = null;
  private meltVersion = -1;

  /** Draw the photo through the frost wherever it's warm. */
  private melt(s: Slide) {
    const w = this.warmth;
    const c = s.melt;
    if (!w || !w.cols || !s.box.w) return;
    const hc = this.heatCanvas;
    if (hc.width !== w.cols || hc.height !== w.rows) {
      hc.width = w.cols;
      hc.height = w.rows;
      this.heatData = null;
    }
    const hx = hc.getContext('2d')!;
    const data = (this.heatData ??= hx.createImageData(w.cols, w.rows));
    let any = false;
    for (let k = 0; k < w.bytes.length; k++) {
      const h = w.bytes[k] / 255;
      // Only real warmth melts it, and never all the way: some frost always stays.
      const a = Math.min(1, Math.max(0, (h - 0.14) / 0.6));
      data.data[k * 4 + 3] = Math.round(a * a * (3 - 2 * a) * 190);
      if (h > 0.01) any = true;
    }
    // One scale for both axes, so the melt lands under the pointer however big the box is.
    const k = Math.min(devicePixelRatio || 1, 1.5, 2400 / s.box.w, 2400 / s.box.h);
    const cw = Math.round(s.box.w * k);
    const ch = Math.round(s.box.h * k);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const ctx = c.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cw, ch);
    // A photo that failed to load can't be drawn (and would throw).
    if (!any || !s.img.complete || !s.img.naturalWidth) return;
    hx.putImageData(data, 0, 0);
    ctx.drawImage(s.img, 0, 0, cw, ch);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(hc, (-CELL - s.box.l) * k, (-CELL + w.shift - s.box.t) * k, w.cols * CELL * k, w.rows * CELL * k);
  }

  update(dt: number) {
    if (this.root.hidden || !this.show) return;
    const portrait = this.portrait;
    const span = portrait ? innerHeight : innerWidth;
    // The frost can't come off the type, and leaves the photo a margin.
    const min = this.typeEnd(portrait) / span;
    const rest = Math.max(min, portrait ? 0.42 : 0.38);
    const left = this.rest ?? rest;
    const target = clamp(left + (this.dragging ? 0 : this.lean * 0.07), min, 0.94);
    const e = this.reduced ? (this.edge.set(target), target) : this.edge.step(target, dt);
    const edgePx = e * span;

    const last = this.slides[this.slides.length - 1];
    // A slow, even dissolve, the new photo settling from a touch closer as it comes.
    for (const s of this.slides) {
      s.t = Math.min(1, s.t + dt / 1.3);
      this.place(s, portrait, edgePx, rest * span);
      const e = s.t * s.t * (3 - 2 * s.t);
      setVar(s.el, '--in', e.toFixed(3));
      setVar(s.el, '--z', (1 + 0.025 * Math.pow(1 - s.t, 2)).toFixed(4));
    }
    if (last && !last.film && this.warmth && (this.warmth.version !== this.meltVersion || last.melt.dataset.at !== String(last.box.w))) {
      this.meltVersion = this.warmth.version;
      last.melt.dataset.at = String(last.box.w);
      this.melt(last);
    }
    // Once the newest photo is up, the ones under it can go.
    if (last && last.t >= 1 && this.slides.length > 1) {
      for (const s of this.slides.slice(0, -1)) s.el.remove();
      this.slides = [last];
    }
  }

  /**
   * Fit the photo: full bleed when its shape is near the window's, otherwise
   * whole inside it with its own frost around it. The clear part starts at
   * the edge, in the photo box's own coordinates.
   */
  private place(s: Slide, portrait: boolean, edgePx: number, restPx: number) {
    const vw = innerWidth;
    const vh = innerHeight;
    // A film is always whole and clear of the frost, at its own shape.
    const ar = s.film ? 16 / 9 : s.im.w / s.im.h;
    const var_ = ar / (vw / vh);
    let bw: number, bh: number, left: number, top: number;
    // Smaller originals (the ones from his site) aren't blown up past about 1.3 times.
    const cap = s.film ? 1920 : s.im.w * 1.3;
    const sharp = !s.film && cap >= vw * 0.85;
    if (sharp && var_ > 0.74 && var_ < 1.35) {
      // Near the window's shape: full bleed.
      if (ar > vw / vh) (bh = vh), (bw = vh * ar);
      else (bw = vw), (bh = vw / ar);
      left = (vw - bw) / 2;
      top = (vh - bh) / 2;
    } else if (portrait) {
      // Whole, edge to edge, in the clear part under the type.
      bw = vw;
      bh = Math.min(bw / ar, vh * 0.9, cap / ar);
      bw = bh * ar;
      left = (vw - bw) / 2;
      top = clamp(restPx + (vh - restPx - bh) / 2, 0, vh - bh);
    } else {
      // Whole, in the clear part beside the type.
      bh = Math.min(vh * 0.84, ((vw - restPx) * 0.9) / ar, cap / ar);
      bw = bh * ar;
      left = clamp(restPx + (vw - restPx - bw) / 2, 0, vw - bw);
      top = (vh - bh) / 2;
    }
    s.box = { l: left, t: top, w: bw, h: bh };
    setVar(s.el, '--bw', `${bw.toFixed(1)}px`);
    setVar(s.el, '--bh', `${bh.toFixed(1)}px`);
    setVar(s.el, '--bl', `${left.toFixed(1)}px`);
    setVar(s.el, '--bt', `${top.toFixed(1)}px`);
    const cut = s.film ? 0 : portrait ? clamp(edgePx - top, 0, bh) : clamp(edgePx - left, 0, bw);
    setVar(s.el, '--cut', `${cut.toFixed(1)}px`);
  }

  private typeKey = '';
  private typeAt = 0;
  /** Where the type on the frost ends (its right edge, or its foot on a phone), measured once per window size. */
  private typeEnd(portrait: boolean) {
    const key = `${innerWidth}x${innerHeight}|${this.show?.slug}`;
    if (key !== this.typeKey) {
      const tb = this.root.querySelector<HTMLElement>('.sh-type')?.getBoundingClientRect();
      this.typeAt = tb ? (portrait ? tb.bottom : tb.right) + 28 : 0;
      this.typeKey = key;
    }
    return this.typeAt;
  }

  private trap(e: KeyboardEvent) {
    const f = [...this.root.querySelectorAll<HTMLElement>('button, a[href]')].filter((el) => !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    const at = document.activeElement;
    const inside = at instanceof HTMLElement && this.root.contains(at) && at !== this.root;
    if (e.shiftKey && (at === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (at === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }
}
