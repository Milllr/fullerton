import { clamp, setAttr, smooth, Spring } from '../lib/dom';
import { Filament, kelvinRgb } from '../light/tungsten';

/*
  The shades catch the light. On the contact logo the window from the
  cover shows as a small reflection in the sunglasses, one in each lens
  (narrower in the far one, which is seen side on), sliding across them
  against the pointer the way a reflection moves in a curved lens. On a
  phone, or with the pointer gone, it slides as the page comes down to
  Contact. It comes up on the tungsten curve when Contact comes into
  view, dim and amber, then clear, and brightens a touch as the pointer
  comes near. It only ever shows on the lenses' own ink.
*/

/** Round the glasses, in the mark's own units: everything else it could catch on is left out. */
const LENS =
  'M1 69L22 74L34 82L60 90L96 109.6L119 109.6L118 120L111 125L94 127.4L84 141L79 147.6L66 145.6L50 133.6L45.6 129L28 121.2L18 119.2L4 113.2L1 90Z';

/** A window of six panes, two across and three down, as the gobo on the cover, brightest at the top as on curved glass. */
const PANES = [-4.25, 0.5]
  .flatMap((x) =>
    [
      [-6, 1],
      [-1.5, 0.78],
      [2.5, 0.56],
    ].map(([y, o]) => `<rect x="${x}" y="${y}" width="3.75" height="3.5" rx="0.45" fill-opacity="${o}"/>`),
  )
  .join('');

/** Where each reflection sits with the light dead ahead, and how it lies on its lens. */
const NEAR = { x: 80, y: 115.5, shape: 'rotate(-10) skewX(-8)' };
const FAR = { x: 36, y: 97, shape: 'rotate(-6) scale(0.45 1)' };

const WARM_WHITE = [255, 243, 226];

export class Glint {
  private el: SVGGElement;
  private near: SVGGElement;
  private far: SVGGElement;
  private stops: Element[];
  private u = new Spring(0.6, 0.9, 0.9);
  private v = new Spring(0, 0.9, 0.9);
  private f = new Filament(0.3);
  private visible = false;
  private box = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    host: HTMLElement,
    mark: string,
    private reduced: boolean,
  ) {
    const d = mark.match(/ d="([^"]+)"/)?.[1] ?? '';
    host.insertAdjacentHTML(
      'beforeend',
      `<svg class="cl-glint" viewBox="0 0 157.5 230.5" aria-hidden="true">
        <defs>
          <clipPath id="cl-ink"><path clip-rule="evenodd" d="${d}"/></clipPath>
          <clipPath id="cl-lens"><path d="${LENS}"/></clipPath>
          <filter id="cl-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.4"/></filter>
          <radialGradient id="cl-bloom"><stop offset="0" stop-opacity="0.24"/><stop offset="1" stop-opacity="0"/></radialGradient>
          <symbol id="cl-window" overflow="visible"><ellipse rx="10" ry="8.5" fill="url(#cl-bloom)"/>${PANES}</symbol>
        </defs>
        <g clip-path="url(#cl-ink)"><g clip-path="url(#cl-lens)">
          <g class="cl-refl" filter="url(#cl-soft)" opacity="0">
            <g class="cl-far"><use href="#cl-window" transform="${FAR.shape}"/></g>
            <g class="cl-near"><use href="#cl-window" transform="${NEAR.shape}"/></g>
          </g>
        </g></g>
      </svg>`,
    );
    this.el = host.querySelector('.cl-refl')!;
    this.near = host.querySelector('.cl-near')!;
    this.far = host.querySelector('.cl-far')!;
    this.stops = [...host.querySelectorAll('#cl-bloom stop')];
    new IntersectionObserver((es) => {
      this.visible = es[es.length - 1].isIntersecting;
      this.measure();
    }).observe(host);
    addEventListener('resize', () => this.measure());
    if (reduced) {
      this.f.settle(0.8);
      this.u.set(0.35);
    }
  }

  private measure() {
    const r = this.el.ownerSVGElement!.getBoundingClientRect();
    this.box = { x: r.left, y: r.top + scrollY, w: r.width, h: r.height };
  }

  /** `pointer` is where the pointer or a finger is; `y` the page's scroll position. */
  update(dt: number, pointer: { x: number; y: number; here: boolean }, y: number) {
    if (!this.visible && this.f.theta < 0.01) return;
    const cx = this.box.x + this.box.w / 2;
    const cy = this.box.y - y + this.box.h * 0.45;
    let u: number, v: number;
    if (pointer.here) {
      // A reflection moves against the light: the pointer to the right sends it left.
      u = -clamp((pointer.x - cx) / (innerWidth * 0.45), -1, 1);
      v = -clamp((pointer.y - cy) / (innerHeight * 0.5), -1, 1);
    } else {
      // No pointer: it slides across as Contact comes up the screen.
      u = 1 - 1.6 * clamp((innerHeight - cy) / innerHeight, 0, 1);
      v = 0;
    }
    const near = pointer.here ? 1 - smooth(0, Math.max(innerWidth, innerHeight) * 0.5, Math.hypot(pointer.x - cx, pointer.y - cy)) : 0;
    if (!this.reduced) {
      u = this.u.step(u, dt);
      v = this.v.step(v, dt);
      this.f.step(this.visible ? 0.72 + 0.28 * near : 0, dt);
    } else {
      u = this.u.x;
      v = 0;
    }
    // Along each lens, which runs down to the right; the near one is the wider, so it travels further.
    setAttr(this.near, 'transform', `translate(${(NEAR.x + u * 13).toFixed(2)} ${(NEAR.y + u * 1.6 + v * 2.5).toFixed(2)})`);
    setAttr(this.far, 'transform', `translate(${(FAR.x + u * 4).toFixed(2)} ${(FAR.y + u * 1 + v * 2.5).toFixed(2)})`);
    // Amber while the filament comes up, clearing to a warm white.
    const k = kelvinRgb(Math.max(1000, this.f.kelvin));
    const t = smooth(0.25, 1, this.f.bright);
    const c = `rgb(${k.map((ch, i) => Math.round(ch * 255 + (WARM_WHITE[i] - ch * 255) * t)).join(',')})`;
    setAttr(this.el, 'fill', c);
    for (const s of this.stops) setAttr(s, 'stop-color', c);
    setAttr(this.el, 'opacity', (this.f.bright * 0.62).toFixed(3));
  }
}
