import { clamp, smooth, Spring } from '../lib/dom';

/*
  The scrollbar: a DMX cable. Its male five pin XLR is where you are on the
  page; the cable hangs from it straight down the right edge to the floor,
  where the slack is coiled the way it is on a gig: over/under.

  Loops go onto the pile whole, one at a time, gathered at the side the
  cable comes down to. An over loop opens out of the foot of the cable and
  tips back onto the pile. An under loop is made the other way round: it
  opens flat on the floor in front and is turned over onto the pile, the way
  your wrist turns over for it, so it lies the same way round as the rest
  with its crossing underneath. Over and under loops lie turned a little
  against each other, so at the gather they cross: the over loops across the
  bundle, the under loops tucked beneath it. At the top of the page one loop
  is down; scroll and the connector comes down with you while a loop is laid
  for each stretch of cable, and scroll back up and they come back off. The
  hanging cable is simulated (under gravity, with a little stiffness), so it
  swings when it's moved and settles by itself. Drag the connector to scroll.
*/

interface Geo {
  w: number;
  h: number;
  /** Where the cable hangs; the coil lies to its left, gathered under it. */
  track: number;
  /** Screen height of the floor at the gather. */
  floor: number;
  /** Top of the travel. */
  top: number;
  /** Loop radius, cable thickness, connector scale and length. */
  r: number;
  thick: number;
  s: number;
  conn: number;
}

type V3 = [number, number, number];
type P2 = [number, number];

interface Flight {
  /** Which loop, how far through being laid (0 to 1) and which way it's going. */
  k: number;
  t: number;
  dir: 1 | -1;
}

interface Run {
  pts: P2[];
  z: number;
  /** Clear a hairline of paper around it, so what it crosses reads as underneath. */
  carve: boolean;
  /** How dark its shadow: lighter on the pile, where it mostly falls on more cable. */
  shade?: number;
}

/** Small fixed irregularities, so the coil looks laid by hand. */
const jitter = (k: number, salt: number) => {
  const x = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

const TAU = Math.PI * 2;
/** How steeply the floor is seen: the coil looks this much as deep as it is wide. */
const SIN_E = 0.45;
const COS_E = Math.sqrt(1 - SIN_E * SIN_E);
/** Loops laid by the bottom of the page, on top of the one already down. */
const LOOPS = 9;
/** How far each loop is turned at the gather, over loops one way and under loops the other. */
const TILT = 0.24;
/** Points per loop, and how many of them either side of the gather cross the bundle there. */
const SEGS = 60;
const GATHER = 5;
/** Points in the simulated hang. */
const N = 40;
/** An over loop stands leaning back a little before it tips onto the pile. */
const LEAN = 1.36;

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
  /** Where the hang meets the coil, following the loop in the air quickly but not instantly. */
  private foot = { x: new Spring(0, 9, 1), y: new Spring(0, 9, 1) };
  /** Loops lying on the pile, and the ones in the air above it, lowest first. */
  private rest = 1;
  private flights: Flight[] = [];
  private ready = false;
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
      const p = clamp((e.clientY - offset - this.g.top) / this.travel(), 0, 1);
      scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight));
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
    const r = small ? 8 : 12;
    const s = small ? 0.66 : 0.86;
    this.g = {
      w,
      h,
      track: w - (small ? 8 : 11),
      // Room below for an under loop opening on the floor in front.
      floor: h - 3.2 * r * SIN_E - (small ? 4 : 6),
      top: small ? 8 : 12,
      r,
      thick: small ? 1.4 : 2,
      s,
      conn: 31 * s,
    };
    this.rope = new Float32Array(0);
    this.ready = false;
    this.lastKey = '';
  }

  /** How far the connector can travel: it stops above where the loops stand up. */
  private travel() {
    const g = this.g;
    return g.floor - 2.3 * g.r * COS_E - g.conn - g.top;
  }

  private connectorY(p: number) {
    return this.g.top + p * this.travel();
  }

  /** On the floor at the gather: x right, y up, z towards you; to the screen. */
  private at([x, y, z]: V3): P2 {
    return [this.g.track + x, this.g.floor - y * COS_E + z * SIN_E];
  }

  /** Loop `k` as it lies on the pile: where it's gathered, how big, and which way it's turned. */
  private loop(k: number) {
    const g = this.g;
    const under = k % 2 === 1;
    const r = g.r * (1 + jitter(k, 1) * 0.07);
    const tilt = (under ? -TILT : TILT) + jitter(k, 7) * 0.04;
    // The gathers sit a little apart along the side, like a braid.
    const gather: V3 = [jitter(k, 5) * g.thick * 0.3, k * g.thick * 0.17, (((k * 0.618) % 1) - 0.5) * g.thick * 2.4];
    const c: V3 = [gather[0] - r * Math.cos(tilt), gather[1], gather[2] - r * Math.sin(tilt)];
    const pts: V3[] = [];
    // From the gather it goes back, round the far side and the front, and back to the gather.
    for (let i = 0; i <= SEGS; i++) {
      const a = tilt - (i / SEGS) * TAU;
      pts.push([c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]);
    }
    return { under, pts, gather, hinge: c[2] + r };
  }

  /**
   * Loop `k` in the air, `t` of the way through being laid. It's turned up
   * about its front edge (`theta`, 0 lying on the pile, a quarter turn
   * standing, a half turn lying flat in front, mirrored) and opened out of
   * the line of the cable (`open`).
   */
  private posed(k: number, t: number): { pts: V3[]; up: number } {
    const { under, pts, gather, hinge } = this.loop(k);
    let open: number;
    let theta: number;
    if (under) {
      // Opens flat in front, then is turned over onto the pile: quick off the floor, slow over the top, quick down.
      open = smooth(0, 0.3, t);
      const s = clamp((t - 0.32) / 0.68, 0, 1);
      if (s < 0.86) {
        const u = s / 0.86;
        theta = Math.PI * (1 - (u + (0.62 * Math.sin(TAU * u)) / TAU));
      } else theta = 0.1 * Math.sin((Math.PI * (s - 0.86)) / 0.14);
    } else {
      // Opens standing, then tips back like anything hinged at its foot: slowly, then all at once.
      open = smooth(0, 0.34, t);
      const s = clamp((t - 0.3) / 0.7, 0, 1);
      theta = s < 0.82 ? LEAN * (1 - Math.pow(s / 0.82, 2.3)) : 0.09 * Math.sin((Math.PI * (s - 0.82)) / 0.18);
    }
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    return {
      pts: pts.map(([x, y, z]) => {
        const dz = z - hinge;
        return [gather[0] + (x - gather[0]) * open, y - dz * st, hinge + dz * ct] as V3;
      }),
      up: Math.sin(Math.min(theta, Math.PI / 2)) * open,
    };
  }

  /** Starts, runs and lands the loops in the air. Returns whether there are any. */
  private lay(want: number, dt: number) {
    const F = this.flights;
    if (!this.ready || this.reduced) {
      this.rest = want;
      F.length = 0;
      this.ready = true;
      return false;
    }
    const shown = () => this.rest + F.filter((f) => f.dir > 0).length;
    const gap = want - shown();
    if (Math.abs(gap) > 3) {
      // A jump down or up the page: the loops in between go straight to where they belong, the last one laid or lifted in view.
      F.length = 0;
      if (gap > 0) {
        this.rest = want - 1;
        F.push({ k: want - 1, t: 0.25, dir: 1 });
      } else {
        this.rest = want;
        F.push({ k: want, t: 0.75, dir: -1 });
      }
    } else if (gap > 0) {
      // One that was coming off goes back down; otherwise the next one is laid once the last is well on its way.
      const back = F.find((f) => f.dir < 0);
      const top = F[F.length - 1];
      if (back) back.dir = 1;
      else if (!top || top.t > 0.5) F.push({ k: this.rest + F.length, t: 0, dir: 1 });
    } else if (gap < 0) {
      const down = F.filter((f) => f.dir > 0).pop();
      if (down) down.dir = -1;
      else if (this.rest > 1 && (!F.length || F[0].t < 0.5)) {
        this.rest--;
        F.unshift({ k: this.rest, t: 1, dir: -1 });
      }
    }
    // Behind by more than a loop, they go down quicker.
    const speed = 1 + Math.min(2, Math.abs(want - shown()) * 0.7);
    for (const f of F) f.t = clamp(f.t + (f.dir * dt * speed) / (f.k % 2 ? 0.95 : 0.75), 0, 1);
    // They land from the bottom and come off from the top, in order.
    while (F.length && F[0].dir > 0 && F[0].t >= 1 && F[0].k === this.rest) {
      F.shift();
      this.rest++;
    }
    while (F.length && F[F.length - 1].dir < 0 && F[F.length - 1].t <= 0) F.pop();
    return F.length > 0;
  }

  /** Where the hang meets the coil: the gather of the loop on top, wherever that loop is. */
  private end(): P2 {
    const F = this.flights;
    if (F.length) {
      const f = F[F.length - 1];
      return this.at(this.posed(f.k, f.t).pts[SEGS]);
    }
    return this.at(this.loop(this.rest).gather);
  }

  /**
   * The hang, as a real rope: a chain of points under gravity with a little
   * stiffness, pinned at the connector and where it meets the coil, leaving
   * both straight (the boot holds it straight out of the connector). Moving
   * either end sets it swinging, and it settles by itself. Returns whether
   * anything is still moving.
   */
  private simulate(dt: number, ax: number, ay: number, bx: number, by: number) {
    const dist = Math.hypot(bx - ax, by - ay);
    const seg = (dist * 1.004 + Math.min(1.5, dist * 0.01)) / N;
    const R = this.rope;
    const gx = bx;
    const gy = by - seg;
    if (R.length !== (N + 1) * 2 || this.reduced) {
      if (R.length !== (N + 1) * 2) {
        this.rope = new Float32Array((N + 1) * 2);
        this.last = new Float32Array((N + 1) * 2);
      }
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        this.rope[i * 2] = this.last[i * 2] = ax + (bx - ax) * t;
        this.rope[i * 2 + 1] = this.last[i * 2 + 1] = ay + (by - ay) * t;
      }
      return !this.reduced;
    }
    const L = this.last;
    const G = 1500;
    let left = Math.min(dt, 0.05);
    while (left > 1e-4) {
      const h = Math.min(left, 1 / 120);
      left -= h;
      for (let i = 2; i < N - 1; i++) {
        const xi = i * 2;
        const vx = (R[xi] - L[xi]) * 0.97;
        const vy = (R[xi + 1] - L[xi + 1]) * 0.97;
        L[xi] = R[xi];
        L[xi + 1] = R[xi + 1];
        R[xi] += vx;
        R[xi + 1] += vy + G * h * h;
      }
      for (let it = 0; it < 12; it++) {
        R[0] = ax;
        R[1] = ay;
        R[2] = ax;
        R[3] = ay + seg;
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
          const k = (l - seg) / l;
          const fa = i <= 1 || i >= N - 1 ? 0 : 1;
          const fb = i + 1 <= 1 || i + 1 >= N - 1 ? 0 : 1;
          const s = fa + fb || 1;
          R[a] += (dx * k * fa) / s;
          R[a + 1] += (dy * k * fa) / s;
          R[b] -= (dx * k * fb) / s;
          R[b + 1] -= (dy * k * fb) / s;
        }
        // A little stiffness, so it bends like rubber cable rather than folding like string.
        for (let i = 2; i < N - 1; i++) {
          const a = (i - 1) * 2;
          const m = i * 2;
          const c = (i + 1) * 2;
          R[m] += ((R[a] + R[c]) / 2 - R[m]) * 0.08;
          R[m + 1] += ((R[a + 1] + R[c + 1]) / 2 - R[m + 1]) * 0.08;
        }
      }
    }
    let moving = 0;
    for (let i = 2; i < N - 1; i++) moving = Math.max(moving, Math.abs(R[i * 2] - L[i * 2]) + Math.abs(R[i * 2 + 1] - L[i * 2 + 1]));
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
    // A loop goes down a little before its stretch of cable is all there, so it can go down whole.
    const flying = this.lay(1 + Math.floor(p * LOOPS + 0.3), dt);
    const [ex, ey] = this.end();
    if (!this.rope.length) {
      this.foot.x.set(ex);
      this.foot.y.set(ey);
    }
    const fx = this.reduced ? ex : this.foot.x.step(ex, dt);
    const fy = this.reduced ? ey : this.foot.y.step(ey, dt);
    const moving = this.simulate(dt, g.track, yc + g.conn, fx, fy);
    const key = `${p.toFixed(4)}|${this.rest}|${g.w}x${g.h}`;
    if (!moving && !flying && key === this.lastKey && this.foot.y.settled) return;
    this.lastKey = key;
    this.draw(yc, [ex, ey]);
    const tr = `translate3d(0,${(yc - 4).toFixed(1)}px,0)`;
    if (this.grip.style.transform !== tr) this.grip.style.transform = tr;
    this.grip.style.height = `${(g.conn + 8).toFixed(0)}px`;
  }

  private draw(yc: number, end: P2) {
    const { ctx, dpr } = this;
    const g = this.g;
    const runs: Run[] = [];
    const scr = (pts: V3[]) => pts.map((q) => this.at(q));

    // The far end runs in along the front of the first loop, just inside it, from where it lies out to the left with its female connector.
    const first = this.loop(0).pts;
    const tail = scr([
      [-g.r * 2.95, 0, -g.r * 0.55],
      [-g.r * 2.45, 0, -g.r * 0.3],
      ...first.slice(SEGS / 2, SEGS).map(([x, y, z], i, a) => {
        const inset = 0.9 * g.thick * Math.sin((Math.PI * i) / a.length);
        return [x + inset * 0.3, y, z - inset] as V3;
      }),
      first[SEGS],
    ]);
    runs.push({ pts: tail, z: -1e4, carve: false });

    // The pile, in the order it was laid. Where each loop passes the gather, an over loop goes across the bundle, an under loop beneath it.
    for (let k = 0; k < this.rest; k++) {
      const { under, pts } = this.loop(k);
      const s = scr(pts);
      const next = this.at(this.loop(k + 1).gather);
      const gz = under ? -5e3 + k : 1e4 + k;
      runs.push({ pts: s.slice(0, GATHER + 2), z: gz, carve: false, shade: 0.12 });
      runs.push({ pts: s.slice(GATHER, SEGS - GATHER + 1), z: k, carve: false, shade: 0.12 });
      runs.push({ pts: [...s.slice(SEGS - GATHER - 1), next], z: gz, carve: false, shade: 0.12 });
    }

    // The loops in the air, each joined to the one before it.
    let prev = this.at(this.loop(this.rest).gather);
    for (const f of this.flights) {
      const { pts, up } = this.posed(f.k, f.t);
      const s = scr(pts);
      runs.push({ pts: [prev, ...s], z: 2e4 + f.k, carve: up > 0.3 });
      prev = s[SEGS];
    }

    // The hang, as simulated, from where it meets the coil.
    const R = this.rope;
    const hang: P2[] = [end];
    for (let i = N; i >= 0; i--) hang.push([R[i * 2], R[i * 2 + 1]]);
    runs.push({ pts: hang, z: 3e4, carve: false });
    runs.sort((a, b) => a.z - b.z);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (const run of runs) this.tube(run);
    const tl = tail[1];
    this.female(tail[0][0], tail[0][1], Math.atan2(tail[0][1] - tl[1], tail[0][0] - tl[0]));
    this.male(g.track, yc);
  }

  /** One stretch of cable: a hairline of paper cleared round it if it crosses others, its shadow, then rubber. */
  private tube({ pts, carve, shade = 0.2 }: Run) {
    const { ctx, dpr } = this;
    const g = this.g;
    if (pts.length < 2) return;
    if (carve) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = g.thick + 1;
      this.path(pts);
      ctx.restore();
    }
    // The shadow, offset away from the light: drawn far off the canvas so only the shadow lands.
    ctx.save();
    ctx.translate(10000, 0);
    ctx.shadowColor = `rgba(60, 38, 18, ${shade})`;
    ctx.shadowBlur = 3 * dpr;
    ctx.shadowOffsetX = (-10000 + 1.4) * dpr;
    ctx.shadowOffsetY = 2.2 * dpr;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = g.thick;
    this.path(pts);
    ctx.restore();
    // Rubber: a dark edge, the body, and a sheen from the light up and to the left.
    ctx.strokeStyle = 'rgba(12, 11, 10, 0.92)';
    ctx.lineWidth = g.thick + 0.9;
    this.path(pts);
    ctx.strokeStyle = '#22201d';
    ctx.lineWidth = g.thick;
    this.path(pts);
    ctx.strokeStyle = 'rgba(255, 246, 232, 0.26)';
    ctx.lineWidth = Math.max(0.55, g.thick * 0.28);
    this.path(pts.map(([x, y]) => [x - 0.27, y - 0.45] as P2));
  }

  private path(pts: P2[]) {
    const { ctx } = this;
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

  /** The other end, lying on the floor pointing away (`ang`, from where its cable comes in): just the body and its latch. */
  private female(x: number, y: number, ang: number) {
    const { ctx } = this;
    const s = this.g.s * 0.82;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(s, s);
    // The boot ends where the cable does.
    ctx.translate(8, 0);
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
