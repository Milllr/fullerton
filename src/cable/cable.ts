import { clamp, Spring } from '../lib/dom';

/*
  The scrollbar: a DMX cable. Its male five pin XLR is where you are on the
  page; the cable hangs from it down the right edge to the floor, and the
  slack is coiled there, the way a cable is coiled on a gig: over/under.
  Every other loop is turned (its sheen rolls across the cable once) and
  its crossing goes under the bundle, while the loops between cross over
  it, so the crossings along the front read over, under, over like a braid. At the top
  of the page the cable is out at full length; scroll down and the
  connector comes down with you and the cable is laid into the coil the
  way a fed rope coils on a floor: where it touches down travels round and
  round, laying loop after loop, and the hanging cable (simulated, under
  gravity, with a little stiffness) swings round with it. Drag the
  connector to scroll.
*/

interface Geo {
  w: number;
  h: number;
  /** Where the cable runs down. */
  track: number;
  /** Top of the travel and the coil's centre on the floor. */
  top: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Cable thickness and connector size. */
  thick: number;
  s: number;
  conn: number;
}

/** Small fixed irregularities, so the coil looks laid by hand. */
const jitter = (k: number, salt: number) => {
  const x = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

const TAU = Math.PI * 2;
/** Where loops begin and end on the coil (front right, under the hang), and how much of each loop the crossing to the next row takes. */
const PHI0 = 0.35;
const CROSS = 0.85 / TAU;
/** Points in the simulated hang. */
const N = 40;
const ease = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class Cable {
  private ctx: CanvasRenderingContext2D;
  private g!: Geo;
  private dpr = 1;
  private p = new Spring(0, 2.4, 0.82);
  private grip: HTMLElement;
  private dragging = false;
  /** The hanging cable, simulated: where each point is and where it was. */
  private rope = new Float32Array(0);
  private last = new Float32Array(0);
  private lastKey = '';

  constructor(
    private canvas: HTMLCanvasElement,
    private reduced: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.grip = document.createElement('div');
    this.grip.className = 'cable-grip';
    this.grip.setAttribute('aria-hidden', 'true');
    canvas.after(this.grip);
    this.bind();
    this.resize();
  }

  private bind() {
    let offset = 0;
    this.grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.grip.setPointerCapture(e.pointerId);
      offset = e.clientY - this.connectorY(this.p.x);
      document.documentElement.classList.add('cable-drag');
      e.preventDefault();
    });
    this.grip.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const g = this.g;
      const travel = this.travel();
      const p = clamp((e.clientY - offset - g.top) / travel, 0, 1);
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, p * max);
    });
    const end = () => {
      this.dragging = false;
      document.documentElement.classList.remove('cable-drag');
    };
    this.grip.addEventListener('pointerup', end);
    this.grip.addEventListener('pointercancel', end);
  }

  resize() {
    const small = innerWidth < 700;
    const w = small ? 42 : 66;
    const h = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const s = small ? 0.66 : 0.86;
    const rx = small ? 11 : 17;
    this.g = {
      w,
      h,
      track: w - (small ? 9 : 13),
      top: small ? 8 : 12,
      cx: w - (small ? 9 : 13) - rx * 0.96,
      cy: h - (small ? 12 : 18),
      rx,
      ry: rx * 0.34,
      thick: small ? 1.35 : 2,
      s,
      conn: 31 * s,
    };
    this.rope = new Float32Array(0);
    this.lastKey = '';
  }

  /** How far the connector can travel. */
  private travel() {
    const g = this.g;
    return g.cy - g.ry - 16 * g.s - g.conn - g.top;
  }

  private connectorY(p: number) {
    return this.g.top + p * this.travel();
  }

  /** Over/under: the over loops lie in the outer row, the turned under loops in the inner row, each loop a touch higher on the pile. */
  private ring(k: number) {
    const g = this.g;
    const under = k % 2 === 1;
    const spread = g.thick * 1.45;
    const rx = g.rx + (under ? -spread : spread) * 0.5 + jitter(k, 1) * 0.35;
    return { cx: g.cx + jitter(k, 3) * 0.35, cy: g.cy - k * g.thick * 0.3, rx, ry: (rx / g.rx) * g.ry };
  }

  /**
   * The coil as one continuous path: `phi` goes round and round from where
   * the cable first touches the floor. Over the last stretch of each loop
   * it crosses from that loop's row to the next one's.
   */
  private coilPoint(phi: number): [number, number] {
    const u = Math.max(0, (phi - PHI0) / TAU);
    const k = Math.floor(u);
    const w = ease(1 - CROSS, 1, u - k);
    const a = this.ring(k);
    const b = this.ring(k + 1);
    const cx = a.cx + (b.cx - a.cx) * w;
    const cy = a.cy + (b.cy - a.cy) * w;
    const rx = a.rx + (b.rx - a.rx) * w;
    const ry = a.ry + (b.ry - a.ry) * w;
    return [cx + Math.cos(phi) * rx, cy + Math.sin(phi) * ry];
  }

  private coilPath(from: number, to: number): [number, number][] {
    const n = Math.max(2, Math.ceil((to - from) / 0.1));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) pts.push(this.coilPoint(from + ((to - from) * i) / n));
    return pts;
  }

  /**
   * The hang, as a real rope: a chain of points under gravity with a little
   * stiffness, pinned at the connector and where it meets the floor, where
   * it leaves the coil along the way it's being laid. Moving the connector
   * or the laying point sets it swinging, and it settles by itself.
   * Returns whether anything is still moving.
   */
  private simulate(dt: number, ax: number, ay: number, bx: number, by: number, tx: number, ty: number) {
    const dist = Math.hypot(bx - ax, by - ay);
    const seg = (dist * 1.015 + 6) / N;
    const R = this.rope;
    // From the floor the cable goes on the way it's being laid for a moment, then rises.
    const gx = bx + tx * seg * 0.9;
    const gy = by + ty * seg * 0.9 - seg * 0.55;
    if (R.length !== (N + 1) * 2 || this.reduced) {
      if (R.length !== (N + 1) * 2) {
        this.rope = new Float32Array((N + 1) * 2);
        this.last = new Float32Array((N + 1) * 2);
      }
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        this.rope[i * 2] = this.last[i * 2] = ax + (gx - ax) * t;
        this.rope[i * 2 + 1] = this.last[i * 2 + 1] = ay + (gy - ay) * t;
      }
      this.rope[N * 2] = bx;
      this.rope[N * 2 + 1] = by;
      return !this.reduced;
    }
    const L = this.last;
    const G = 1500;
    let moving = 0;
    let left = Math.min(dt, 0.05);
    while (left > 1e-4) {
      const h = Math.min(left, 1 / 120);
      left -= h;
      for (let i = 1; i < N; i++) {
        const xi = i * 2;
        const vx = (R[xi] - L[xi]) * 0.975;
        const vy = (R[xi + 1] - L[xi + 1]) * 0.975;
        L[xi] = R[xi];
        L[xi + 1] = R[xi + 1];
        R[xi] += vx;
        R[xi + 1] += vy + G * h * h;
      }
      for (let it = 0; it < 12; it++) {
        R[0] = ax;
        R[1] = ay;
        R[(N - 1) * 2] = gx;
        R[(N - 1) * 2 + 1] = gy;
        R[N * 2] = bx;
        R[N * 2 + 1] = by;
        for (let i = 0; i < N; i++) {
          const a = i * 2;
          const b = a + 2;
          const dx = R[b] - R[a];
          const dy = R[b + 1] - R[a + 1];
          const l = Math.hypot(dx, dy) || 1e-6;
          const k = ((l - seg) / l) * 0.5;
          const fa = i === 0 || i >= N - 1 ? 0 : 1;
          const fb = i + 1 >= N - 1 ? 0 : 1;
          const s = fa + fb || 1;
          R[a] += (dx * k * 2 * fa) / s;
          R[a + 1] += (dy * k * 2 * fa) / s;
          R[b] -= (dx * k * 2 * fb) / s;
          R[b + 1] -= (dy * k * 2 * fb) / s;
        }
        // A little stiffness, so it bends like rubber cable rather than folding like string.
        for (let i = 1; i < N - 1; i++) {
          const a = (i - 1) * 2;
          const m = i * 2;
          const c = (i + 1) * 2;
          const mx = (R[a] + R[c]) / 2;
          const my = (R[a + 1] + R[c + 1]) / 2;
          R[m] += (mx - R[m]) * 0.08;
          R[m + 1] += (my - R[m + 1]) * 0.08;
        }
      }
    }
    for (let i = 1; i < N; i++) moving = Math.max(moving, Math.abs(R[i * 2] - L[i * 2]) + Math.abs(R[i * 2 + 1] - L[i * 2 + 1]));
    return moving > 0.004;
  }

  /** `y` and `docH`: the scroll position and page height, read once at the top of the frame. */
  update(dt: number, y: number, docH: number) {
    const max = docH - innerHeight;
    const target = max > 0 ? clamp(y / max, 0, 1) : 0;
    let p: number;
    if (this.reduced) {
      this.p.set(target);
      p = target;
    } else p = this.p.step(target, dt);
    const g = this.g;
    const yc = this.connectorY(p);
    // The slack is however far the connector has come down; it's laid round the coil from where the cable touches the floor.
    const perim = 2 * Math.PI * Math.sqrt((g.rx * g.rx + g.ry * g.ry) / 2);
    const phiL = PHI0 + ((p * this.travel()) / perim) * TAU;
    const [bx, by] = this.coilPoint(phiL);
    const [nx, ny] = this.coilPoint(phiL + 0.05);
    const tl = Math.hypot(nx - bx, ny - by) || 1;
    const moving = this.simulate(dt, g.track, yc + g.conn, bx, by, (nx - bx) / tl, (ny - by) / tl);
    const key = `${p.toFixed(4)}|${g.w}x${g.h}`;
    if (!moving && key === this.lastKey) return;
    this.lastKey = key;
    this.draw(yc, phiL);
    const t = `translate3d(0,${(yc - 4).toFixed(1)}px,0)`;
    if (this.grip.style.transform !== t) this.grip.style.transform = t;
    this.grip.style.height = `${(g.conn + 8).toFixed(0)}px`;
  }

  private draw(yc: number, phiL: number) {
    const { ctx, dpr } = this;
    const g = this.g;

    // Everything to draw, in the order it's laid, each with whether it's a turned loop.
    const runs: { pts: [number, number][]; turned: boolean }[] = [];

    // The far end and its female connector, lying out on the floor from under the first loop.
    const start = this.coilPoint(PHI0);
    const tailEnd: [number, number] = [g.cx - g.rx * 1.55, g.cy + g.ry * 1.35];
    runs.push({ pts: [tailEnd, [g.cx - g.rx * 0.6, g.cy + g.ry * 1.25], [start[0] - 3, start[1] + 1], start], turned: false });

    // The coil, loop by loop. The crossing into an under loop goes under everything; into an over loop, over what's there.
    const laid = (phiL - PHI0) / TAU;
    const loops = Math.ceil(laid);
    const segs: { pts: [number, number][]; z: number; turned: boolean }[] = [];
    for (let k = 0; k < loops; k++) {
      const a0 = PHI0 + k * TAU;
      const mainEnd = Math.min(phiL, a0 + (1 - CROSS) * TAU);
      segs.push({ pts: this.coilPath(a0, mainEnd), z: k, turned: k % 2 === 1 });
      if (phiL > mainEnd) {
        const over = (k + 1) % 2 === 0;
        segs.push({ pts: this.coilPath(mainEnd, Math.min(phiL, a0 + TAU)), z: over ? k + 0.5 : -1, turned: !over });
      }
    }
    segs.sort((a, c) => a.z - c.z);
    for (const s of segs) runs.push(s);

    // The hang, as simulated.
    const R = this.rope;
    const hang: [number, number][] = [];
    for (let i = 0; i <= N; i++) hang.push([R[i * 2], R[i * 2 + 1]]);
    runs.push({ pts: hang, turned: false });
    // Laid at the back of the coil, the cable goes down behind the front of the pile.
    if (Math.sin(phiL) < -0.15) {
      for (let k = 0; k < Math.floor(laid); k++) {
        const a0 = PHI0 + k * TAU;
        const base = TAU * Math.floor(a0 / TAU);
        const to = Math.min(a0 + (1 - CROSS) * TAU, base + Math.PI - 0.15);
        if (to > a0) runs.push({ pts: this.coilPath(a0, to), turned: k % 2 === 1 });
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Its shadow on the paper first, offset away from the light: drawn far off the canvas so only the shadow lands.
    ctx.save();
    ctx.translate(10000, 0);
    ctx.shadowColor = 'rgba(60, 38, 18, 0.2)';
    ctx.shadowBlur = 3.5 * dpr;
    ctx.shadowOffsetX = (-10000 + 1.6) * dpr;
    ctx.shadowOffsetY = 2.4 * dpr;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = g.thick;
    for (const r of runs) this.path(ctx, r.pts);
    ctx.restore();

    // Rubber: a dark edge, the body, and a sheen from the light up and to the left. A turned loop's sheen rolls across the cable once.
    for (const { pts, turned } of runs) {
      if (pts.length < 2) continue;
      ctx.strokeStyle = 'rgba(12, 11, 10, 0.92)';
      ctx.lineWidth = g.thick + 0.9;
      this.path(ctx, pts);
      ctx.strokeStyle = '#22201d';
      ctx.lineWidth = g.thick;
      this.path(ctx, pts);
      ctx.strokeStyle = 'rgba(255, 246, 232, 0.26)';
      ctx.lineWidth = Math.max(0.55, g.thick * 0.28);
      const n = pts.length - 1;
      this.path(
        ctx,
        pts.map(([x, y], i) => {
          const o = turned ? 0.5 * Math.cos((Math.PI * i) / n) : -0.45;
          return [x + o * 0.6, y + o] as [number, number];
        }),
      );
    }
    this.female(tailEnd[0], tailEnd[1]);
    this.male(g.track, yc);
  }

  private path(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
    ctx.stroke();
  }

  /** The male XLR, nose up: satin nickel shell, a darker chuck, a black rubber boot. */
  private male(x: number, y: number) {
    const { ctx } = this;
    const s = this.g.s;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(60, 38, 18, 0.22)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1.6;
    ctx.shadowOffsetY = 2.6;
    const metal = ctx.createLinearGradient(-4.4, 0, 4.4, 0);
    metal.addColorStop(0, '#6f6b65');
    metal.addColorStop(0.3, '#e9e5dd');
    metal.addColorStop(0.55, '#a29d95');
    metal.addColorStop(1, '#4b4844');
    ctx.fillStyle = metal;
    this.round(-4.3, 0, 8.6, 13.5, 1.6);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // The open nose and the key slot down the side.
    ctx.fillStyle = 'rgba(30, 28, 25, 0.55)';
    ctx.fillRect(-3.6, 0.6, 7.2, 1.1);
    ctx.fillStyle = 'rgba(30, 28, 25, 0.35)';
    ctx.fillRect(1.6, 1.8, 0.7, 6.5);
    // The chuck.
    const chuck = ctx.createLinearGradient(-4, 0, 4, 0);
    chuck.addColorStop(0, '#3e3b37');
    chuck.addColorStop(0.35, '#8c877f');
    chuck.addColorStop(1, '#2c2a27');
    ctx.fillStyle = chuck;
    this.round(-4, 13.3, 8, 3.2, 0.8);
    ctx.fill();
    // The boot, tapering to the cable, with grip ridges.
    const rub = ctx.createLinearGradient(-3.8, 0, 3.8, 0);
    rub.addColorStop(0, '#141312');
    rub.addColorStop(0.32, '#4a4642');
    rub.addColorStop(0.6, '#1f1d1b');
    rub.addColorStop(1, '#0e0d0c');
    ctx.fillStyle = rub;
    ctx.beginPath();
    ctx.moveTo(-3.8, 16.4);
    ctx.lineTo(3.8, 16.4);
    ctx.bezierCurveTo(3.7, 22, 2.1, 27, 1.5, 31);
    ctx.lineTo(-1.5, 31);
    ctx.bezierCurveTo(-2.1, 27, -3.7, 22, -3.8, 16.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 246, 232, 0.12)';
    ctx.lineWidth = 0.5;
    for (const ry of [19, 21.4, 23.8]) {
      const half = 3.6 - (ry - 16.4) * 0.17;
      ctx.beginPath();
      ctx.moveTo(-half, ry);
      ctx.lineTo(half, ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The other end, lying on the floor pointing away: just the body and its latch. */
  private female(x: number, y: number) {
    const { ctx } = this;
    const s = this.g.s * 0.82;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(Math.PI * 0.94);
    ctx.shadowColor = 'rgba(60, 38, 18, 0.2)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1.2;
    ctx.shadowOffsetY = 1.6;
    const metal = ctx.createLinearGradient(0, -4.4, 0, 4.4);
    metal.addColorStop(0, '#6f6b65');
    metal.addColorStop(0.3, '#e2ded6');
    metal.addColorStop(1, '#4b4844');
    ctx.fillStyle = metal;
    this.round(-2, -4.4, 14, 8.8, 1.6);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#1b1a18';
    this.round(-8, -3.4, 6.4, 6.8, 1.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(30, 28, 25, 0.6)';
    ctx.fillRect(7, -4.6, 3, 1.2);
    ctx.restore();
  }

  private round(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
