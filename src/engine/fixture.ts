import { CHALK } from './plate';

type V3 = [number, number, number];

/**
 * The moving head itself, drawn as a hairline wireframe like a lighting
 * symbol in a CAD plot. It hangs from the truss and turns in 3D as it pans
 * and tilts. Returns where the lens sits on screen so the beam starts there.
 */
export class Fixture {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** Canvas size in css px. */
  w = 240;
  h = 190;
  /** Tilt axis inside the canvas, css px. */
  pivotX = 120;
  pivotY = 118;
  scale = 1;
  /** Fraction drawn, for the opening cue. */
  progress = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(scale: number) {
    this.scale = scale;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  /** Screen position of the pivot, given where the canvas sits. */
  pivotOnScreen() {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + this.pivotX, y: r.top + this.pivotY };
  }

  draw(pan: number, tilt: number, level: number, colour: [number, number, number]) {
    const c = this.ctx;
    const k = this.scale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    const cam = 520;
    const proj = ([x, y, z]: V3): [number, number, number] => {
      const f = cam / (cam - z * k);
      return [this.pivotX + x * k * f, this.pivotY + y * k * f, z];
    };
    const cp = Math.cos(pan), sp = Math.sin(pan);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const yaw = ([x, y, z]: V3): V3 => [x * cp - z * sp, y, x * sp + z * cp];
    const pitch = ([x, y, z]: V3): V3 => [x, y * ct - z * st, y * st + z * ct];
    const head = (p: V3) => yaw(pitch(p));

    const segs: [V3, V3, number][] = [];
    const line = (a: V3, b: V3, w = 1) => segs.push([a, b, w]);

    // Hanging clamp and base (does not rotate).
    const top = -96;
    line([0, -118, 0], [0, top, 0], 0.8);
    line([-9, -118, 0], [9, -118, 0], 0.8);
    const bx = 34, by0 = top, by1 = top + 18, bz = 26;
    const base: V3[] = [
      [-bx, by0, -bz], [bx, by0, -bz], [bx, by0, bz], [-bx, by0, bz],
      [-bx, by1, -bz], [bx, by1, -bz], [bx, by1, bz], [-bx, by1, bz],
    ];
    const box = (v: V3[], w = 1) => {
      for (let i = 0; i < 4; i++) {
        line(v[i], v[(i + 1) % 4], w);
        line(v[i + 4], v[((i + 1) % 4) + 4], w);
        line(v[i], v[i + 4], w);
      }
    };
    box(base);

    // Yoke: turns with pan.
    const ya = 36, yTop = by1 + 4;
    const yoke: V3[] = [
      [-ya, yTop, 0], [ya, yTop, 0], [-ya, 6, 0], [ya, 6, 0],
      [-ya, yTop, 7], [ya, yTop, 7], [-ya, 6, 7], [ya, 6, 7],
    ].map((p) => yaw(p as V3));
    line(yoke[0], yoke[1]);
    line(yoke[4], yoke[5], 0.6);
    line(yoke[0], yoke[2]);
    line(yoke[1], yoke[3]);
    line(yoke[4], yoke[6], 0.6);
    line(yoke[5], yoke[7], 0.6);
    line(yoke[2], yoke[6], 0.6);
    line(yoke[3], yoke[7], 0.6);
    line(yaw([0, by1, 0]), yaw([0, yTop, 0]));

    // Head: a cylinder pointing along -z before tilt and pan.
    const R = 27, zBack = 22, zFront = -34, N = 20;
    const ring = (z: number, r: number) => {
      const pts: V3[] = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push(head([Math.cos(a) * r, Math.sin(a) * r, z]));
      }
      return pts;
    };
    const back = ring(zBack, R * 0.86), front = ring(zFront, R), lens = ring(zFront - 1, R * 0.68);
    for (let i = 0; i < N; i++) {
      line(back[i], back[(i + 1) % N], 0.8);
      line(front[i], front[(i + 1) % N]);
      line(lens[i], lens[(i + 1) % N], 0.7);
      if (i % 3 === 0) line(back[i], front[i], 0.6);
    }
    // Trunnions where the head meets the yoke.
    line(yaw([-ya, 0, 0]), head([-R, 0, 0]), 0.8);
    line(yaw([ya, 0, 0]), head([R, 0, 0]), 0.8);

    const n = Math.floor(segs.length * this.progress);
    for (let i = 0; i < n; i++) {
      const [a, b, w] = segs[i];
      const pa = proj(a), pb = proj(b);
      const depth = (a[2] + b[2]) / 2; // toward viewer is positive
      const alpha = Math.max(0.18, Math.min(0.75, 0.42 + depth / 90)) * w;
      c.strokeStyle = `rgba(${CHALK}, ${alpha})`;
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(pa[0], pa[1]);
      c.lineTo(pb[0], pb[1]);
      c.stroke();
    }

    const lensC = proj(head([0, 0, zFront - 1]));
    if (level > 0.01 && this.progress >= 1) {
      const [r, g, b] = colour;
      const col = `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
      const lp = lens.map(proj);
      c.beginPath();
      lp.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fillStyle = `rgba(${col}, ${0.85 * level})`;
      c.fill();
    }
    return { x: lensC[0], y: lensC[1] };
  }
}
