/*
  Warmth. Wherever the pointer goes the paper warms in a wide, soft
  radius, and it keeps the heat a while: it cools the way a filament does,
  quickly at first and then a long amber tail. On a phone a touch blooms,
  a held finger keeps heating where it rests, and dragging or scrolling
  leaves a trail. The heat belongs to the paper, so it scrolls away with
  the page.

  The heat lives in a coarse grid (one cell per CELL px) that the shader
  reads as a texture and smooths.
*/

export const CELL = 24;

interface Pointer {
  x: number;
  y: number;
  /** Where it was last frame, to lay heat along the way it moved. */
  px: number;
  py: number;
  here: boolean;
  down: boolean;
}

export class Warmth {
  cols = 0;
  rows = 0;
  heat = new Float32Array(0);
  bytes = new Uint8Array(0);
  /** Sub-cell scroll offset, px, so the heat slides smoothly with the page. */
  shift = 0;
  /** True when the texture needs uploading. */
  dirty = true;
  /** Goes up every time the heat changes, for anything else that draws it. */
  version = 0;
  /** How far across the window the warmest point is, for things that lean towards it. */
  hot = { x: 0.5, y: 0.5, h: 0 };
  private next = new Float32Array(0);
  private p: Pointer = { x: 0, y: 0, px: 0, py: 0, here: false, down: false };
  private blooms: [number, number, number, number][] = [];
  private radius = 220;
  private lastScroll = scrollY;
  private live = false;

  constructor() {
    const move = (x: number, y: number) => {
      if (!this.p.here) {
        this.p.px = x;
        this.p.py = y;
      }
      this.p.x = x;
      this.p.y = y;
      this.p.here = true;
    };
    addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'mouse' || e.pointerType === 'pen') move(e.clientX, e.clientY);
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => (this.p.here = false));
    addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') this.bloom(e.clientX, e.clientY, 1, 0.22);
      },
      { passive: true },
    );
    // Touch: positions keep coming while the page scrolls under the finger.
    addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        if (!t) return;
        this.p.here = false;
        move(t.clientX, t.clientY);
        this.p.down = true;
        this.bloom(t.clientX, t.clientY, 1.25, 0.42);
      },
      { passive: true },
    );
    addEventListener(
      'touchmove',
      (e) => {
        const t = e.touches[0];
        if (t) move(t.clientX, t.clientY);
      },
      { passive: true },
    );
    const lift = (e: TouchEvent) => {
      if (e.touches.length) return;
      this.p.down = false;
      this.p.here = false;
    };
    addEventListener('touchend', lift, { passive: true });
    addEventListener('touchcancel', lift, { passive: true });
  }

  /** A burst of warmth: a tap, a click. `size` scales the radius. */
  bloom(x: number, y: number, size: number, amount: number) {
    this.blooms.push([x, y, size, amount]);
  }

  resize(vw: number, vh: number) {
    const cols = Math.ceil(vw / CELL) + 3;
    const rows = Math.ceil(vh / CELL) + 3;
    this.radius = Math.max(150, Math.min(340, Math.max(vw, vh) * 0.17));
    if (cols === this.cols && rows === this.rows) return;
    const old = this.heat;
    const oc = this.cols;
    const or = this.rows;
    this.cols = cols;
    this.rows = rows;
    this.heat = new Float32Array(cols * rows);
    this.next = new Float32Array(cols * rows);
    this.bytes = new Uint8Array(cols * rows);
    for (let j = 0; j < Math.min(or, rows); j++)
      for (let i = 0; i < Math.min(oc, cols); i++) this.heat[j * cols + i] = old[j * oc + i];
    this.dirty = true;
    this.version++;
  }

  /** Cell centres sit at ((i - 0.5) CELL, (j - 0.5) CELL + shift). */
  private splat(x: number, y: number, r: number, amount: number) {
    const { cols, rows, heat } = this;
    const gx = x / CELL + 0.5;
    const gy = (y - this.shift) / CELL + 0.5;
    const rc = r / CELL;
    const s2 = 2 * (rc / 2) * (rc / 2);
    const i0 = Math.max(0, Math.floor(gx - rc));
    const i1 = Math.min(cols - 1, Math.ceil(gx + rc));
    const j0 = Math.max(0, Math.floor(gy - rc));
    const j1 = Math.min(rows - 1, Math.ceil(gy + rc));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const d2 = (i - gx) ** 2 + (j - gy) ** 2;
        const w = Math.exp(-d2 / s2);
        if (w < 0.01) continue;
        const k = j * cols + i;
        heat[k] += amount * w * (1 - heat[k]);
      }
    this.live = true;
  }

  /** `sy` is the page's scroll position, read once at the top of the frame. */
  update(dt: number, sy: number) {
    if (!this.cols) return;
    const { cols, rows } = this;
    dt = Math.min(dt, 0.05);

    // The heat is on the paper: when the page scrolls, it goes with it.
    const dy = sy - this.lastScroll;
    this.lastScroll = sy;
    if (dy) {
      this.shift -= dy;
      while (this.shift <= -CELL || this.shift >= CELL) {
        const up = this.shift < 0;
        const h = this.heat;
        if (up) {
          h.copyWithin(0, cols);
          h.fill(0, (rows - 1) * cols);
          this.shift += CELL;
        } else {
          h.copyWithin(cols, 0, (rows - 1) * cols);
          h.fill(0, 0, cols);
          this.shift -= CELL;
        }
      }
      this.dirty = true;
      this.version++;
    }

    const p = this.p;
    const r = this.radius;
    for (const [x, y, size, amount] of this.blooms) this.splat(x, y, r * size, amount);
    this.blooms.length = 0;
    if (p.here) {
      // Lay heat along the way the pointer moved, then a little more where it rests.
      const dist = Math.hypot(p.x - p.px, p.y - p.py);
      const steps = Math.min(24, Math.ceil(dist / (CELL * 0.75)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        this.splat(p.px + (p.x - p.px) * t, p.py + (p.y - p.py) * t, r, Math.min(0.09, 0.0045 * (dist / steps)));
      }
      this.splat(p.x, p.y, p.down ? r * 1.1 : r, dt * (p.down ? 1.1 : 0.32));
      p.px = p.x;
      p.py = p.y;
    }

    if (!this.live) return;
    // Cooling, fast and then slow, and a little spreading out.
    const h = this.heat;
    const n = this.next;
    const D = Math.min(0.2, 3 * dt);
    let any = false;
    let best = 0;
    let bi = 0;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const c = h[k];
        const l = i > 0 ? h[k - 1] : c;
        const rr = i < cols - 1 ? h[k + 1] : c;
        const u = j > 0 ? h[k - cols] : c;
        const d = j < rows - 1 ? h[k + cols] : c;
        let v = c + D * (l + rr + u + d - 4 * c);
        v -= dt * (0.22 * v + 1.15 * v * v * v);
        v = v < 0.002 ? 0 : v;
        n[k] = v;
        if (v > 0) any = true;
        if (v > best) {
          best = v;
          bi = k;
        }
      }
    this.heat = n;
    this.next = h;
    const b = this.bytes;
    for (let k = 0; k < b.length; k++) b[k] = Math.min(255, Math.round(n[k] * 255));
    this.hot = { x: ((bi % cols) - 0.5) * CELL, y: (Math.floor(bi / cols) - 0.5) * CELL + this.shift, h: best };
    this.dirty = true;
    this.version++;
    if (!any) this.live = false;
  }
}
