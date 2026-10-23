import { clamp, Spring } from '../lib/dom';

/*
  The scrollbar: a DMX cable. Its male five pin XLR is where you are on the
  page; the cable hangs from it down the right edge to the floor, and the
  slack is coiled there, the way a cable is coiled on a gig: over/under.
  Every other loop is turned (its sheen rolls across the cable once) and
  its crossing goes under the bundle, while the loops between cross over
  it, so the crossings along the front read over, under, over like a braid. At the top
  of the page the cable is out at full length; scroll down and the
  connector comes down with you while the cable is laid into the coil
  loop by loop, the newest loop sweeping round as it goes. Drag the
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

export class Cable {
  private ctx: CanvasRenderingContext2D;
  private g!: Geo;
  private dpr = 1;
  private p = new Spring(0, 2.4, 0.82);
  private sway = new Spring(0, 1.4, 0.35);
  private lastKey = '';
  private grip: HTMLElement;
  private dragging = false;
  private lastP = 0;
  /** The cable is drawn here first, then onto the page with one shadow. */
  private buf: HTMLCanvasElement | null = null;

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

  /** `y` and `docH`: the scroll position and page height, read once at the top of the frame. */
  update(dt: number, y: number, docH: number) {
    const max = docH - innerHeight;
    const target = max > 0 ? clamp(y / max, 0, 1) : 0;
    let p: number;
    if (this.reduced) {
      this.p.set(target);
      p = target;
    } else p = this.p.step(target, dt);
    // A quick move sets the hanging cable swinging a little.
    const v = (p - this.lastP) / Math.max(dt, 1e-3);
    this.lastP = p;
    const sw = this.reduced ? 0 : this.sway.step(clamp(-v * 3.2, -4, 4), dt);
    const key = `${p.toFixed(4)}|${sw.toFixed(2)}|${this.g.h}|${this.g.w}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(p, sw);
    const g = this.g;
    const cy = this.connectorY(p);
    const t = `translate3d(0,${(cy - 4).toFixed(1)}px,0)`;
    if (this.grip.style.transform !== t) this.grip.style.transform = t;
    this.grip.style.height = `${(g.conn + 8).toFixed(0)}px`;
  }

  /**
   * Point on loop `k` of the coil at angle `a` (0 at the right, going round
   * the front first). Over/under coiling: the over loops lie a little
   * outside, the turned under loops a little inside, so the coil lies as a
   * neat bundle two strands wide, each loop a touch higher on the pile.
   */
  private loopPoint(k: number, a: number): [number, number] {
    const g = this.g;
    const under = k % 2 === 1;
    const spread = g.thick * 1.45;
    const rx = g.rx + (under ? -spread : spread) * 0.5 + jitter(k, 1) * 0.35;
    const ry = (rx / g.rx) * g.ry;
    const cx = g.cx + jitter(k, 3) * 0.35;
    const cy = g.cy - k * g.thick * 0.3;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  }

  /** Where loop `k` starts: each a little further round, so the crossings run along the front like a braid. */
  private start(k: number) {
    return 0.3 + k * 0.34;
  }

  private draw(p: number, sw: number) {
    const { ctx, dpr } = this;
    const g = this.g;
    const buf = (this.buf ??= document.createElement('canvas'));
    if (buf.width !== this.canvas.width || buf.height !== this.canvas.height) {
      buf.width = this.canvas.width;
      buf.height = this.canvas.height;
    }
    const b = buf.getContext('2d')!;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, g.w, g.h);
    b.lineCap = 'round';
    b.lineJoin = 'round';

    const yc = this.connectorY(p);
    const yBoot = yc + g.conn;
    const yFloor = g.cy - g.ry - 3;
    // The slack is however far the connector has come down.
    const perim = 2 * Math.PI * Math.sqrt((g.rx * g.rx + g.ry * g.ry) / 2);
    const laid = p * this.travel();
    const loopsF = laid / perim;
    const full = Math.floor(loopsF);
    const frac = loopsF - full;
    const gap = 0.85;
    const TAU = Math.PI * 2;
    const arc = (k: number, from: number, to: number) => {
      const n = Math.max(2, Math.ceil(Math.abs(to - from) / 0.12));
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) pts.push(this.loopPoint(k, from + ((to - from) * i) / n));
      return pts;
    };

    // The loops laid so far, and the crossing from each into the next: into an over loop it crosses over the bundle, into an under loop under it.
    const arcs: { pts: [number, number][]; k: number }[] = [];
    const crossings: { pts: [number, number][]; over: boolean }[] = [];
    for (let k = 0; k < full; k++) {
      const s0 = this.start(k);
      const s1 = this.start(k + 1) + TAU;
      arcs.push({ pts: arc(k, s0, s1 - gap), k });
      // Across from this loop's row to the next one's, over the angle of the gap.
      const pts: [number, number][] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const e = t * t * (3 - 2 * t);
        const [ax, ay] = this.loopPoint(k, s1 - gap + gap * t);
        const [bx, by] = this.loopPoint(k + 1, s1 - gap + gap * t);
        pts.push([ax + (bx - ax) * e, ay + (by - ay) * e]);
      }
      crossings.push({ pts, over: (k + 1) % 2 === 0 });
    }
    // The loop being laid now.
    const cur0 = this.start(full);
    const curEnd = cur0 + (TAU + 0.34 - gap) * frac;
    const cur = frac > 0.001 ? arc(full, cur0, curEnd) : [this.loopPoint(full, cur0)];
    const [qx, qy] = cur[cur.length - 1];

    // The tail and its female connector, lying out on the floor from under the first loop.
    const t0 = this.loopPoint(0, this.start(0));
    const tailEnd: [number, number] = [g.cx - g.rx * 1.55, g.cy + g.ry * 1.35];
    const tail: [number, number][] = [tailEnd, [g.cx - g.rx * 0.6, g.cy + g.ry * 1.25], [t0[0] - 3, t0[1] + 1], t0];

    // The rise from the coil up to the hang: it leaves the coil along the loop,
    // lifts over the pile and turns up into the hang without a kink.
    const top: [number, number] = [g.track, Math.min(yFloor - 10, Math.max(yBoot + 2, yFloor - 24))];
    const [ax, ay] = this.loopPoint(full, curEnd + 0.05);
    const tx = ax - qx;
    const ty = ay - qy;
    const tl = Math.hypot(tx, ty) || 1;
    const reach = 7 + Math.abs(qx - g.track) * 0.35;
    const c1: [number, number] = [qx + (tx / tl) * reach, qy + (ty / tl) * reach - 4];
    const c2: [number, number] = [top[0], top[1] + Math.max(6, (qy - top[1]) * 0.7)];
    const rise: [number, number][] = [];
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const u = 1 - t;
      rise.push([
        u * u * u * qx + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * top[0],
        u * u * u * qy + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * top[1],
      ]);
    }
    const hang: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      // A gentle bow when it swings, pinned at both ends.
      hang.push([g.track + Math.sin(Math.PI * t) * sw + Math.sin(t * 9.4 + 1.3) * 0.18, top[1] + (yBoot - top[1]) * t]);
    }

    // Rubber: a dark edge, the body, and a sheen from the light up and to the left. A turned loop's sheen rolls across the cable once.
    const tube = (pts: [number, number][], turned = false) => {
      b.strokeStyle = 'rgba(12, 11, 10, 0.92)';
      b.lineWidth = g.thick + 0.9;
      this.path(b, pts);
      b.strokeStyle = '#22201d';
      b.lineWidth = g.thick;
      this.path(b, pts);
      b.strokeStyle = 'rgba(255, 246, 232, 0.26)';
      b.lineWidth = Math.max(0.55, g.thick * 0.28);
      const n = pts.length - 1;
      this.path(
        b,
        pts.map(([x, y], i) => {
          const o = turned ? 0.5 * Math.cos((Math.PI * i) / n) : -0.45;
          return [x + o * 0.6, y + o] as [number, number];
        }),
      );
    };

    tube(tail);
    // Crossings into an under loop go first, so every loop lies over them and they show only between the rows.
    for (const c of crossings) if (!c.over) tube(c.pts, true);
    arcs.forEach(({ pts, k }) => {
      tube(pts, k % 2 === 1);
      // A crossing into an over loop goes over everything laid so far: its edge cuts across the bundle.
      const c = crossings[k];
      if (c?.over) tube(c.pts);
    });
    if (cur.length > 1) tube(cur, full % 2 === 1);
    tube([...rise, ...hang]);

    // Onto the page with its shadow, offset away from the light.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.shadowColor = 'rgba(60, 38, 18, 0.22)';
    ctx.shadowBlur = 3.5 * dpr;
    ctx.shadowOffsetX = 1.6 * dpr;
    ctx.shadowOffsetY = 2.4 * dpr;
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
