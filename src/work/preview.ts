import { imageUrl, keyImage, type Show } from '../data/shows';
import { setVar, smooth, Spring } from '../lib/dom';
import { Filament, kelvinRgb, rgbTriplet } from '../light/tungsten';

/*
  A small print of a show that follows the pointer while it's over
  something that names the show (a row of All work, a network on the
  cover). It sits above the pointer, so the pointer and the words under it
  stay in view, and it comes up out of the frost like a lamp.
*/

export class Preview {
  private el: HTMLElement;
  private img: HTMLImageElement;
  private f = new Filament(0.24);
  private on: Show | null = null;
  private x = new Spring(0, 2.2, 0.9);
  private y = new Spring(0, 2.2, 0.9);
  private tx = 0;
  private ty = 0;
  private seen = false;

  constructor(private reduced: boolean) {
    this.el = document.createElement('div');
    this.el.className = 'aw-preview';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = '<img alt="" /><i class="pl-tint"></i>';
    document.body.append(this.el);
    this.img = this.el.querySelector('img')!;
  }

  /** Show `s` (or nothing) at the pointer. */
  show(s: Show | null, x?: number, y?: number) {
    if (x != null && y != null) this.point(x, y);
    if (s === this.on) return;
    this.on = s;
    if (!s) return;
    this.img.src = imageUrl(s.slug, keyImage(s).id, 'm');
    // A new print comes up from cold.
    this.f.theta = Math.min(this.f.theta, 0.35);
  }

  point(x: number, y: number) {
    this.tx = x;
    this.ty = y;
    if (!this.seen) {
      this.x.set(x);
      this.y.set(y);
      this.seen = true;
    }
  }

  /** Wire an element that names a show: hovering it shows the print. */
  attach(el: HTMLElement, s: Show) {
    el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && this.show(s, e.clientX, e.clientY));
    el.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && this.point(e.clientX, e.clientY));
    el.addEventListener('pointerleave', () => this.on === s && this.show(null));
  }

  update(dt: number) {
    const f = this.f;
    if (this.reduced) f.settle(this.on ? 1 : 0);
    else f.step(this.on ? 1 : 0, dt);
    const lit = f.bright;
    const g = f.glow;
    if (lit < 0.002 && g < 0.002 && !this.on) {
      if (this.el.style.visibility !== 'hidden') this.el.style.visibility = 'hidden';
      this.seen = false;
      return;
    }
    if (this.el.style.visibility !== 'visible') this.el.style.visibility = 'visible';
    const x = this.reduced ? this.tx : this.x.step(this.tx, dt);
    const y = this.reduced ? this.ty : this.y.step(this.ty, dt);
    // Above the pointer and a little to its left; below it only when there's no room above.
    const w = Math.min(460, Math.max(220, innerWidth * 0.22));
    const h = (w * 2) / 3;
    const px = Math.min(innerWidth - w - 56, Math.max(16, x - w * 0.3));
    const py = y - h - 26 < 70 ? y + 30 : y - h - 26;
    const t = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`;
    if (this.el.style.transform !== t) this.el.style.transform = t;
    const bb = kelvinRgb(Math.max(1000, f.kelvin));
    const warm = Math.min(1, g * 1.6) * (1 - 0.75 * lit * lit);
    setVar(this.el, '--tint', rgbTriplet([0, 1, 2].map((k) => 1 + (bb[k] - 1) * warm) as [number, number, number]));
    setVar(this.el, '--lit', smooth(0, 0.6, Math.max(lit, g * 0.6)).toFixed(3));
  }
}
