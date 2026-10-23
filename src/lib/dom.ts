/*
  Per-frame style writes. Setting a custom property, even to the value it
  already has, can invalidate style for everything that inherits it, so each
  element remembers what it was last given and only changed values are
  written.
*/
const written = new WeakMap<HTMLElement | SVGElement, Map<string, string>>();

export function setVar(el: HTMLElement | SVGElement, name: string, value: string) {
  let m = written.get(el);
  if (!m) written.set(el, (m = new Map()));
  if (m.get(name) === value) return;
  m.set(name, value);
  el.style.setProperty(name, value);
}

export function setText(el: Element, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

export function setAttr(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A damped spring towards a target, the way everything on the page moves:
 * nothing snaps. `freq` is the natural frequency in Hz, `damp` the damping
 * ratio (1 settles without overshoot).
 */
export class Spring {
  v = 0;
  constructor(
    public x: number,
    public freq = 1.6,
    public damp = 1,
  ) {}
  target = NaN;
  step(target: number, dt: number) {
    this.target = target;
    const w = 2 * Math.PI * this.freq;
    // Substeps keep it stable when a frame comes late.
    let left = Math.min(dt, 0.1);
    while (left > 0) {
      const h = Math.min(left, 1 / 120);
      const a = -w * w * (this.x - target) - 2 * this.damp * w * this.v;
      this.v += a * h;
      this.x += this.v * h;
      left -= h;
    }
    return this.x;
  }
  get settled() {
    return Math.abs(this.x - this.target) < 1e-3 && Math.abs(this.v) < 1e-3;
  }
  set(x: number) {
    this.x = x;
    this.v = 0;
  }
}
