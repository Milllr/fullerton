import { imageUrl, keyImage, type Show } from '../data/shows';
import { clamp, esc, setText, setVar, smooth, Spring } from '../lib/dom';
import { Filament, kelvinRgb, rgbTriplet } from '../light/tungsten';

/*
  The showcase: every show as a plate of frosted glass in a stack that
  recedes in depth, pinned while the page scrolls through it. Scrolling
  draws the stack forward one plate at a time; the plate in front comes up
  out of the frost the way a tungsten lamp comes up, dim and amber first,
  then clear, and while it's held there it steps through that show's
  photos. Hover a plate behind it and it warms and lifts, with its name at
  the pointer; click it to bring it forward. Click the front plate, or
  View the show, to open it. The numbered rules along the foot jump to any
  show.
*/

const pad = (n: number) => String(n).padStart(2, '0');

interface Plate {
  el: HTMLElement;
  clear: HTMLImageElement;
  next: HTMLImageElement;
  haze: HTMLElement;
  f: Filament;
  /** The cycling photo coming up over the current one. */
  nf: Filament;
  loaded: boolean;
  photo: number;
}

export class Showcase {
  private plates: Plate[] = [];
  private pos = new Spring(0, 1.15, 1);
  active = -1;
  private hover = -1;
  /** Where the pointer is over the front plate, -1..1 each way, and the tilt that follows it. */
  private aim = { x: 0, y: 0 };
  private tiltX = new Spring(0, 1.4, 0.8);
  private tiltY = new Spring(0, 1.4, 0.8);
  private top = 0;
  private height = 0;
  private lastScroll = -1;
  private still = 0;
  private held = 0;
  private stage: HTMLElement;
  private text: HTMLElement;
  private cur: HTMLElement;
  private ticks: HTMLButtonElement[];
  private bar: HTMLElement;
  /** The words at the pointer: two of them, so the last can fade where it is as the next comes up. */
  private labels: HTMLElement[];
  private lab = 0;
  private labelX = new Spring(0, 3, 1);
  private labelY = new Spring(0, 3, 1);
  private pointer = { x: 0, y: 0 };
  private labelOff = 0;
  private swap = 0;
  onOpen: (show: Show, from: HTMLElement) => void = () => {};

  constructor(
    private root: HTMLElement,
    private shows: Show[],
    private reduced: boolean,
  ) {
    const n = shows.length;
    root.style.setProperty('--n', String(n));
    root.innerHTML = `
      <div class="sc-pin">
        <div class="sc-info">
          <p class="sc-no"><span class="sc-cur">01</span><span class="sc-of"> / ${pad(n)}</span></p>
          <div class="sc-text"></div>
        </div>
        <div class="deck">
          <div class="deck-stage">${shows
            .map((s, i) => {
              const im = keyImage(s);
              return `<div class="plate" data-i="${i}">
                <img class="pl-frost" alt="" decoding="async" width="${im.w}" height="${im.h}" />
                <img class="pl-clear" alt="" decoding="async" />
                <img class="pl-next" alt="" decoding="async" />
                <i class="pl-tint"></i><i class="pl-haze"></i><i class="pl-sheen"></i>
              </div>`;
            })
            .join('')}</div>
        </div>
        <nav class="sc-ticks" aria-label="Shows">${shows
          .map((s, i) => `<button type="button" data-i="${i}" aria-label="${esc(s.title)}"><span>${pad(i + 1)}</span></button>`)
          .join('')}<i class="sc-bar"></i></nav>
        <button class="sc-skip" type="button" aria-label="Skip to all work"><svg viewBox="0 0 14 40" aria-hidden="true"><path d="M7 0v37M1.5 31.5L7 37l5.5-5.5" /></svg></button>
      </div>
      <p class="sc-label" aria-hidden="true"><span></span></p><p class="sc-label" aria-hidden="true"><span></span></p>`;
    this.stage = root.querySelector('.deck-stage')!;
    this.text = root.querySelector('.sc-text')!;
    this.cur = root.querySelector('.sc-cur')!;
    this.ticks = [...root.querySelectorAll<HTMLButtonElement>('.sc-ticks button')];
    this.bar = root.querySelector('.sc-bar')!;
    this.labels = [...root.querySelectorAll<HTMLElement>('.sc-label')];
    this.plates = [...root.querySelectorAll<HTMLElement>('.plate')].map((el) => ({
      el,
      clear: el.querySelector('.pl-clear')!,
      next: el.querySelector('.pl-next')!,
      haze: el.querySelector('.pl-haze')!,
      f: new Filament(0.3),
      nf: new Filament(0.3),
      loaded: false,
      photo: 0,
    }));

    this.plates.forEach((p, i) => {
      p.el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.pointer = { x: e.clientX, y: e.clientY };
        this.setHover(i);
      });
      p.el.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse' && this.hover === i) this.setHover(-1);
      });
      // On a phone, a finger on the front plate presses it: it leans under the finger and catches the glint.
      p.el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch' || i !== this.active) return;
        this.hover = i;
        this.aimAt(p.el, e.clientX, e.clientY);
      });
      const release = (e: PointerEvent) => {
        if (e.pointerType === 'touch' && this.hover === i) this.hover = -1;
      };
      p.el.addEventListener('pointerup', release);
      p.el.addEventListener('pointercancel', release);
      p.el.addEventListener('click', () => {
        if (i === this.active) this.onOpen(this.shows[i], this.root.querySelector<HTMLElement>('.sc-open') ?? p.el);
        else this.goTo(i);
      });
    });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.pointer = { x: e.clientX, y: e.clientY };
      const front = this.plates[this.active];
      if (front && this.hover === this.active) this.aimAt(front.el, e.clientX, e.clientY);
    });
    root.querySelector('.sc-skip')!.addEventListener('click', () => this.onSkip());
    this.ticks.forEach((b, i) => {
      b.addEventListener('click', () => this.goTo(i));
      // One tab stop for the whole row of rules; the arrow keys move along it.
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? this.shows.length - 1 : clamp(i + d, 0, this.shows.length - 1);
        if (!d && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        this.goTo(j);
        this.ticks[j].focus({ preventScroll: true });
      });
    });
    this.measure();
    this.show(0, true);
  }

  /** Point the front plate's lean and glint at a spot on the screen. */
  private aimAt(el: HTMLElement, x: number, y: number) {
    const r = el.getBoundingClientRect();
    this.aim = { x: ((x - r.left) / r.width) * 2 - 1, y: ((y - r.top) / r.height) * 2 - 1 };
    setVar(el, '--sx', `${(((this.aim.x + 1) / 2) * 100).toFixed(1)}%`);
    setVar(el, '--sy', `${(((this.aim.y + 1) / 2) * 100).toFixed(1)}%`);
  }

  /** The page position where show `i` sits in front. */
  private scrollFor(i: number) {
    const n = this.shows.length;
    return this.top + (i / Math.max(1, n - 1)) * Math.max(0, this.height - innerHeight) + 2;
  }

  /** How the page moves when something asks to go somewhere; main sets a gentler glide. */
  glide: (y: number) => void = (y) => scrollTo({ top: y, behavior: this.reduced ? 'auto' : 'smooth' });
  onSkip: () => void = () => {};

  goTo(i: number) {
    this.glide(this.scrollFor(i));
  }

  /** The stage's size, measured with the rest, so the frame never has to ask for layout. */
  private size = { w: 0, h: 0 };

  measure() {
    const r = this.root.getBoundingClientRect();
    this.top = r.top + scrollY;
    this.height = r.height;
    this.size = { w: this.stage.clientWidth, h: this.stage.clientHeight };
    // Depth that scales with the stage, so the stack fans the same on a big screen as on a laptop.
    this.root.style.setProperty('--persp', `${Math.round(Math.max(1700, this.size.w * 1.9))}px`);
    // A big front plate on a dense screen gets the full size photo.
    this.sharp = this.size.w * 0.66 * (devicePixelRatio || 1) > 1100 ? 'full' : 'm';
  }

  private sharp: 'full' | 'm' = 'm';

  private setHover(i: number) {
    this.hover = i;
    const s = i >= 0 ? this.shows[i] : null;
    const text = s ? (i === this.active ? 'View the show' : s.title) : '';
    const cur = this.labels[this.lab];
    const was = cur.classList.contains('is-on');
    if (s && cur.textContent === text) {
      cur.classList.add('is-on');
      return;
    }
    cur.classList.remove('is-on');
    if (!s) {
      if (was) this.labelOff = performance.now();
      return;
    }
    // Coming up out of nothing, the words start at the pointer rather than drifting over from where they last were.
    if (!was && performance.now() - this.labelOff > 600) {
      this.labelX.set(this.pointer.x);
      this.labelY.set(this.pointer.y);
    }
    this.lab ^= 1;
    const next = this.labels[this.lab];
    setText(next.firstElementChild!, text);
    next.classList.add('is-on');
  }

  /** Put show `i`'s details beside the stack, fading across from the last. */
  private show(i: number, now = false) {
    if (i === this.active) return;
    this.active = i;
    const s = this.shows[i];
    setText(this.cur, pad(i + 1));
    this.ticks.forEach((b, j) => {
      b.setAttribute('aria-current', String(j === i));
      b.tabIndex = j === i ? 0 : -1;
    });
    const fill = () => {
      const meta = [s.short || s.network, s.year, s.kind].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
      this.text.innerHTML = `
        <h3 class="sc-title">${esc(s.title)}</h3>
        <p class="sc-meta">${meta}</p>
        <a class="sc-open" href="#/work/${s.slug}"><span>View the show</span><i aria-hidden="true">→</i></a>`;
      this.text.classList.remove('is-out');
    };
    clearTimeout(this.swap);
    if (now || this.reduced) fill();
    else {
      this.text.classList.add('is-out');
      this.swap = window.setTimeout(fill, 170);
    }
    if (this.hover >= 0) this.setHover(this.hover);
    this.held = 0;
  }

  private load(p: Plate, i: number) {
    if (p.loaded) return;
    p.loaded = true;
    const s = this.shows[i];
    p.el.querySelector<HTMLImageElement>('.pl-frost')!.src = imageUrl(s.slug, keyImage(s).id, 'm');
    p.clear.src = imageUrl(s.slug, keyImage(s).id, this.sharp);
  }

  /** While a show is held in front, step through its photos, each coming up over the last. */
  private cycle(p: Plate, i: number) {
    const s = this.shows[i];
    if (s.images.length < 2 || p.next.dataset.loading) return;
    const keyIdx = s.images.indexOf(keyImage(s));
    const k = (p.photo + 1) % s.images.length;
    const im = s.images[(keyIdx + k) % s.images.length];
    p.next.dataset.loading = '1';
    p.next.src = imageUrl(s.slug, im.id, this.sharp);
    p.next
      .decode()
      .catch(() => {})
      .then(() => {
        delete p.next.dataset.loading;
        p.photo = k;
        p.nf.theta = 0.25;
        p.next.dataset.up = '1';
      });
  }

  /** `y` is the page's scroll position, read once at the top of the frame. */
  update(dt: number, visible: boolean, y: number) {
    if (!visible) return;
    // The words trail the pointer a touch, never stuck to it.
    const lx = this.reduced ? this.pointer.x : this.labelX.step(this.pointer.x, dt);
    const ly = this.reduced ? this.pointer.y : this.labelY.step(this.pointer.y, dt);
    const lt = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0)`;
    for (const l of this.labels) if (l.style.transform !== lt) l.style.transform = lt;
    const n = this.shows.length;
    const vh = innerHeight;
    if (y !== this.lastScroll) {
      this.lastScroll = y;
      this.still = 0;
    } else this.still += dt;
    const span = Math.max(1, this.height - vh);
    const raw = clamp((y - this.top) / span, 0, 1) * (n - 1);
    // Once the page stops, the stack settles on the nearest plate.
    const target = this.still > 0.16 ? Math.round(raw) : raw;
    let pos: number;
    if (this.reduced) {
      this.pos.set(Math.round(raw));
      pos = this.pos.x;
    } else {
      pos = this.pos.step(target, dt);
      this.pos.v = clamp(this.pos.v, -9, 9);
    }
    this.show(clamp(Math.round(pos), 0, n - 1));
    this.held += dt;
    this.bar.style.transform = `scaleX(${(pos / Math.max(1, n - 1)).toFixed(4)})`;

    const { w, h } = this.size;
    const narrow = w < 560;
    // The front plate leans a touch towards the pointer, like a print held up to the light.
    const aiming = this.hover === this.active && this.hover >= 0;
    const tx = this.reduced ? 0 : this.tiltX.step(aiming ? -this.aim.y * 3.2 : 0, dt);
    const ty = this.reduced ? 0 : this.tiltY.step(aiming ? this.aim.x * 4.5 : 0, dt);
    // Stacking: nearest the front on top, the plates gone past under the ones to come. It's written as each
    // plate's place in that order, so a plate's z-index only changes when it really swaps with another,
    // not every few frames as it moves.
    const depth = (i: number) => {
      const d = i - pos;
      return 100 - Math.round(Math.abs(d) * 4) - (d < 0 ? 2 : 0);
    };
    const rank: number[] = [];
    this.plates
      .map((_, i) => i)
      .sort((a, b) => depth(a) - depth(b) || a - b)
      .forEach((i, r) => (rank[i] = r + 1));
    this.plates.forEach((p, i) => {
      const d = i - pos;
      const near = d > -1.5 && d < 7.5;
      if (near || Math.abs(i - this.active) < 3) this.load(p, i);
      const front = i === this.active;
      const hov = i === this.hover && !front;
      if (this.reduced) p.f.settle(front ? 1 : hov ? 0.85 : 0.08);
      else p.f.step(front ? 1 : hov ? 0.85 : 0.08, dt);
      const vis = d < 0 ? smooth(-0.9, -0.05, d) : 1 - smooth(5.5, 7.5, d);
      // How far it's faded and how hazy it is change every frame of a scroll, so they're set straight on
      // the layers they fade rather than as custom properties: a changed custom property repaints the
      // whole plate (blur, shadow and all), where a layer's own opacity is only a fade.
      const op = vis.toFixed(3);
      if (p.el.style.opacity !== op) p.el.style.opacity = op;
      const hidden = vis <= 0.001;
      if (p.el.hidden !== hidden) p.el.hidden = hidden;
      if (hidden) return;
      let x: number, yy: number, z: number, ry: number;
      if (d >= 0) {
        // On a phone the stack climbs more than it spreads, keeping clear of the cable.
        x = d * w * (narrow ? 0.034 : 0.072);
        yy = -d * h * (narrow ? 0.048 : 0.05);
        z = -d * w * 0.2;
        ry = -Math.min(d, 1) * 24 - Math.max(0, d - 1) * 1.5;
      } else {
        x = d * w * 0.34;
        yy = -d * h * 0.04;
        z = -d * w * 0.1;
        ry = -d * 14;
      }
      const lift = hov ? 34 : 0;
      const tilt = front ? ` rotateX(${tx.toFixed(2)}deg) rotateY(${ty.toFixed(2)}deg)` : '';
      const t = `translate3d(${x.toFixed(1)}px,${yy.toFixed(1)}px,${(z + lift).toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)${tilt}`;
      p.el.classList.toggle('is-aimed', front && aiming);
      if (p.el.style.transform !== t) p.el.style.transform = t;
      const zi = String(rank[i]);
      if (p.el.style.zIndex !== zi) p.el.style.zIndex = zi;

      // The front plate steps through its photos while it's held there.
      if (front && !this.reduced && this.held > 3.2 && this.still > 1) {
        this.held = 0;
        this.cycle(p, i);
      }
      // Back to its own photo once it has cooled into the frost, not while it's still showing.
      if (!front && p.photo && (p.f.bright < 0.02 || hidden)) {
        p.photo = 0;
        p.clear.src = imageUrl(this.shows[i].slug, keyImage(this.shows[i]).id, this.sharp);
        delete p.next.dataset.up;
      }
      if (p.next.dataset.up) {
        if (this.reduced) p.nf.settle(1);
        else p.nf.step(1, dt);
        // Once it's fully up, it becomes the plate's photo; the layer over it only goes once that's ready, so nothing flashes.
        if (p.nf.bright > 0.985 && !p.next.dataset.swap) {
          p.next.dataset.swap = '1';
          p.clear.src = p.next.src;
          p.clear
            .decode()
            .catch(() => {})
            .then(() => {
              delete p.next.dataset.swap;
              delete p.next.dataset.up;
              p.nf.theta = 0;
            });
        }
      }
      const nb = p.next.dataset.up ? p.nf.bright : 0;
      setVar(p.el, '--nx', smooth(0.05, 0.85, nb).toFixed(3));

      const f = p.f;
      const lit = f.bright;
      const warm = Math.min(1, f.glow * 1.6) * (1 - 0.75 * lit * lit) + (nb > 0 && nb < 0.95 ? 0.35 * (1 - nb) : 0);
      const bb = kelvinRgb(Math.max(f.kelvin * (nb > 0 && nb < 0.95 ? 0.8 : 1), 1000));
      const tint: [number, number, number] = [0, 1, 2].map((k) => 1 + (bb[k] - 1) * Math.min(1, warm)) as [number, number, number];
      setVar(p.el, '--lit', smooth(0.08, 0.9, lit).toFixed(3));
      setVar(p.el, '--tint', rgbTriplet(tint));
      const haze = clamp((1 - lit) * 0.46 + Math.max(0, d) * 0.045, 0, 0.82).toFixed(3);
      if (p.haze.style.opacity !== haze) p.haze.style.opacity = haze;
    });
  }
}
