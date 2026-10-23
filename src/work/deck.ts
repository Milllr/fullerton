import { imageUrl, keyImage, type Show } from '../data/shows';
import { clamp, esc, setVar, smooth, Spring } from '../lib/dom';
import { Filament, kelvinRgb, rgbTriplet } from '../lamp/tungsten';

/*
  The work: a numbered index like the track list on a record sleeve, and
  beside it every show as a plate of frosted glass, stacked in depth. Point
  at a show (or focus it, or on a phone scroll it to the reading line) and
  the stack slides through to its plate, which comes up out of the frost
  the way a tungsten lamp comes up: dim and amber first, then clear. The
  one it leaves cools back into the frost with an amber afterglow.
*/

const pad = (n: number) => String(n).padStart(2, '0');

interface Plate {
  el: HTMLElement;
  imgs: HTMLImageElement[];
  f: Filament;
  loaded: boolean;
}

export class Deck {
  private rows: HTMLAnchorElement[] = [];
  private plates: Plate[] = [];
  private pos: Spring;
  active = 0;
  private stage: HTMLElement;
  onOpen: (show: Show, from: HTMLElement) => void = () => {};

  constructor(
    list: HTMLElement,
    deck: HTMLElement,
    private shows: Show[],
    private reduced: boolean,
  ) {
    list.innerHTML = shows
      .map(
        (s, i) => `<li><a class="row" href="#/work/${s.slug}" data-i="${i}">
          <span class="row-no">${pad(i + 1)}</span>
          <span class="row-title">${esc(s.title)}</span>
          <span class="row-net">${esc(s.short || s.network || s.kind)}</span>
          <span class="row-year">${esc(s.year)}</span>
        </a></li>`,
      )
      .join('');
    this.rows = [...list.querySelectorAll<HTMLAnchorElement>('.row')];
    deck.innerHTML = `<div class="deck-stage">${shows
      .map((s) => {
        const im = keyImage(s);
        return `<div class="plate" data-slug="${s.slug}" style="--ar:${im.w} / ${im.h}">
          <img class="pl-frost" alt="" decoding="async" width="${im.w}" height="${im.h}" />
          <img class="pl-clear" alt="" decoding="async" width="${im.w}" height="${im.h}" />
          <i class="pl-tint"></i><i class="pl-haze"></i>
        </div>`;
      })
      .join('')}</div>`;
    this.stage = deck.querySelector('.deck-stage')!;
    this.plates = [...deck.querySelectorAll<HTMLElement>('.plate')].map((el) => ({
      el,
      imgs: [...el.querySelectorAll('img')],
      f: new Filament(0.3),
      loaded: false,
    }));
    this.plates[0].f.settle(1);
    this.pos = new Spring(0, 0.9, 1);

    this.rows.forEach((row, i) => {
      row.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') this.select(i);
      });
      row.addEventListener('focus', () => this.select(i));
    });
    // The plate in front opens its show.
    deck.addEventListener('click', () => this.onOpen(this.shows[this.active], this.rows[this.active]));
  }

  select(i: number) {
    this.active = clamp(i, 0, this.shows.length - 1);
    this.rows.forEach((r, j) => r.classList.toggle('is-on', j === this.active));
  }

  /** On a touch screen: the row nearest the reading line is the one lit. */
  follow(readY: number) {
    let best = this.active;
    let bestD = Infinity;
    this.rows.forEach((r, i) => {
      const b = r.getBoundingClientRect();
      const d = Math.abs(b.top + b.height / 2 - readY);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best !== this.active) this.select(best);
  }

  private load(p: Plate, i: number) {
    if (p.loaded) return;
    p.loaded = true;
    const s = this.shows[i];
    const src = imageUrl(s.slug, keyImage(s).id, 'm');
    for (const img of p.imgs) img.src = src;
  }

  update(dt: number, visible: boolean) {
    if (!visible) return;
    let pos: number;
    if (this.reduced) {
      this.pos.set(this.active);
      pos = this.active;
    } else {
      pos = this.pos.step(this.active, dt);
      // Capped speed: a long jump runs through the plates rather than flicking past them.
      this.pos.v = clamp(this.pos.v, -16, 16);
    }
    const w = this.stage.clientWidth;
    const narrow = w < 560;
    const dx = narrow ? w * 0.06 : w * 0.062;
    const dy = narrow ? -w * 0.018 : -w * 0.03;
    const dz = narrow ? -w * 0.17 : -w * 0.19;
    this.plates.forEach((p, i) => {
      const d = i - pos;
      const near = d > -2 && d < 7;
      if (near || Math.abs(i - this.active) < 3) this.load(p, i);
      const on = i === this.active;
      if (this.reduced) p.f.settle(on ? 1 : 0.1);
      else p.f.step(on ? 1 : 0.1, dt);
      const vis = d < 0 ? smooth(-0.85, -0.1, d) : 1 - smooth(4.5, 6.5, d);
      setVar(p.el, '--vis', vis.toFixed(3));
      if (vis <= 0.001) {
        p.el.style.visibility = 'hidden';
        return;
      }
      p.el.style.visibility = '';
      // Plates that have gone by lift towards you and to the left as they fade.
      const lift = d < 0 ? d * 1.6 : d;
      const t = `translate3d(${(lift * dx).toFixed(1)}px,${(lift * dy).toFixed(1)}px,${(lift * dz).toFixed(1)}px) rotateY(-24deg)`;
      if (p.el.style.transform !== t) p.el.style.transform = t;
      p.el.style.zIndex = String(100 - Math.round(d * 4));
      const f = p.f;
      const lit = f.bright;
      const warm = Math.min(1, f.glow * 1.6) * (1 - 0.72 * lit * lit);
      const bb = kelvinRgb(Math.max(f.kelvin, 1000));
      const tint: [number, number, number] = [0, 1, 2].map((k) => 1 + (bb[k] - 1) * warm) as [number, number, number];
      setVar(p.el, '--lit', smooth(0.1, 0.9, lit).toFixed(3));
      setVar(p.el, '--tint', rgbTriplet(tint));
      setVar(p.el, '--haze', clamp((1 - lit) * 0.42 + Math.max(0, d) * 0.05, 0, 0.8).toFixed(3));
    });
  }
}
