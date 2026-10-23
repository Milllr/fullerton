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
  private label: HTMLElement;
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
                <i class="pl-tint"></i><i class="pl-haze"></i>
              </div>`;
            })
            .join('')}</div>
        </div>
        <nav class="sc-ticks" aria-label="Shows">${shows
          .map((s, i) => `<button type="button" data-i="${i}" aria-label="${esc(s.title)}"><span>${pad(i + 1)}</span></button>`)
          .join('')}<i class="sc-bar"></i></nav>
      </div>
      <p class="sc-label" aria-hidden="true"></p>`;
    this.stage = root.querySelector('.deck-stage')!;
    this.text = root.querySelector('.sc-text')!;
    this.cur = root.querySelector('.sc-cur')!;
    this.ticks = [...root.querySelectorAll<HTMLButtonElement>('.sc-ticks button')];
    this.bar = root.querySelector('.sc-bar')!;
    this.label = root.querySelector('.sc-label')!;
    this.plates = [...root.querySelectorAll<HTMLElement>('.plate')].map((el) => ({
      el,
      clear: el.querySelector('.pl-clear')!,
      next: el.querySelector('.pl-next')!,
      f: new Filament(0.3),
      nf: new Filament(0.3),
      loaded: false,
      photo: 0,
    }));

    this.plates.forEach((p, i) => {
      p.el.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') this.setHover(i);
      });
      p.el.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse' && this.hover === i) this.setHover(-1);
      });
      p.el.addEventListener('click', () => {
        if (i === this.active) this.onOpen(this.shows[i], this.root.querySelector<HTMLElement>('.sc-open') ?? p.el);
        else this.goTo(i);
      });
    });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.label.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
    });
    this.ticks.forEach((b, i) => b.addEventListener('click', () => this.goTo(i)));
    this.measure();
    this.show(0, true);
  }

  /** The page position where show `i` sits in front. */
  private scrollFor(i: number) {
    const n = this.shows.length;
    return this.top + (i / Math.max(1, n - 1)) * Math.max(0, this.height - innerHeight) + 2;
  }

  goTo(i: number) {
    scrollTo({ top: this.scrollFor(i), behavior: this.reduced ? 'auto' : 'smooth' });
  }

  measure() {
    const r = this.root.getBoundingClientRect();
    this.top = r.top + scrollY;
    this.height = r.height;
  }

  private setHover(i: number) {
    this.hover = i;
    const s = i >= 0 ? this.shows[i] : null;
    this.root.classList.toggle('is-pointing', !!s);
    if (s) setText(this.label, i === this.active ? `View ${s.images.length} photos` : s.title);
  }

  /** Put show `i`'s details beside the stack, fading across from the last. */
  private show(i: number, now = false) {
    if (i === this.active) return;
    this.active = i;
    const s = this.shows[i];
    setText(this.cur, pad(i + 1));
    this.ticks.forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    const fill = () => {
      const meta = [s.short || s.network, s.year, s.kind].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
      this.text.innerHTML = `
        <h3 class="sc-title">${esc(s.title)}</h3>
        <p class="sc-meta">${meta}</p>
        <a class="sc-open" href="#/work/${s.slug}"><span>View the show</span><span class="sc-count">${s.images.length} photos</span><i aria-hidden="true">→</i></a>`;
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
    const src = imageUrl(s.slug, keyImage(s).id, 'm');
    p.el.querySelector<HTMLImageElement>('.pl-frost')!.src = src;
    p.clear.src = src;
  }

  /** While a show is held in front, step through its photos, each coming up over the last. */
  private cycle(p: Plate, i: number) {
    const s = this.shows[i];
    if (s.images.length < 2 || p.next.dataset.loading) return;
    const keyIdx = s.images.indexOf(keyImage(s));
    const k = (p.photo + 1) % s.images.length;
    const im = s.images[(keyIdx + k) % s.images.length];
    p.next.dataset.loading = '1';
    p.next.src = imageUrl(s.slug, im.id, 'm');
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

  update(dt: number, visible: boolean) {
    if (!visible) return;
    const n = this.shows.length;
    const vh = innerHeight;
    const y = scrollY;
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
    setVar(this.root, '--pos', (pos / Math.max(1, n - 1)).toFixed(4));
    this.bar.style.transform = `scaleX(${(pos / Math.max(1, n - 1)).toFixed(4)})`;

    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    const narrow = w < 560;
    this.plates.forEach((p, i) => {
      const d = i - pos;
      const near = d > -1.5 && d < 7.5;
      if (near || Math.abs(i - this.active) < 3) this.load(p, i);
      const front = i === this.active;
      const hov = i === this.hover && !front;
      if (this.reduced) p.f.settle(front ? 1 : hov ? 0.85 : 0.08);
      else p.f.step(front ? 1 : hov ? 0.85 : 0.08, dt);
      const vis = d < 0 ? smooth(-0.9, -0.05, d) : 1 - smooth(5.5, 7.5, d);
      setVar(p.el, '--vis', vis.toFixed(3));
      const hidden = vis <= 0.001;
      if (p.el.hidden !== hidden) p.el.hidden = hidden;
      if (hidden) return;
      let x: number, yy: number, z: number, ry: number;
      if (d >= 0) {
        x = d * w * (narrow ? 0.06 : 0.072);
        yy = -d * h * (narrow ? 0.035 : 0.05);
        z = -d * w * 0.2;
        ry = -Math.min(d, 1) * 24 - Math.max(0, d - 1) * 1.5;
      } else {
        x = d * w * 0.34;
        yy = -d * h * 0.04;
        z = -d * w * 0.1;
        ry = -d * 14;
      }
      const lift = hov ? 34 : 0;
      const t = `translate3d(${x.toFixed(1)}px,${yy.toFixed(1)}px,${(z + lift).toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)`;
      if (p.el.style.transform !== t) p.el.style.transform = t;
      const zi = String(100 - Math.round(Math.abs(d) * 4) - (d < 0 ? 2 : 0));
      if (p.el.style.zIndex !== zi) p.el.style.zIndex = zi;

      // The front plate steps through its photos while it's held there.
      if (front && !this.reduced && this.held > 3.2 && this.still > 1) {
        this.held = 0;
        this.cycle(p, i);
      }
      if (!front && p.photo) {
        p.photo = 0;
        p.clear.src = imageUrl(this.shows[i].slug, keyImage(this.shows[i]).id, 'm');
        delete p.next.dataset.up;
      }
      if (p.next.dataset.up) {
        if (this.reduced) p.nf.settle(1);
        else p.nf.step(1, dt);
        if (p.nf.bright > 0.985) {
          p.clear.src = p.next.src;
          delete p.next.dataset.up;
          p.nf.theta = 0;
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
      setVar(p.el, '--haze', clamp((1 - lit) * 0.46 + Math.max(0, d) * 0.045, 0, 0.82).toFixed(3));
    });
  }
}
