import { CHALK } from './plate';
import { CAD_FONT, drawFixtureLabel } from './drafting';

type V3 = [number, number, number];
type V2 = [number, number];

/*
  The rig drawn the way Vectorworks draws a Hidden Line render: solid
  objects with their faces filled the colour of the background, painted far
  to near, back faces culled, so edges behind them disappear. Flat faces
  show every edge; the round head shows only its rims and silhouette, the
  way a smooth surface renders. Every line is the same weight.
*/

const FACE = 'rgb(3, 3, 3)';
const EDGE = `rgba(${CHALK}, 0.66)`;

interface Solid {
  /** Faces as loops of transformed points. */
  faces: V3[][];
  /** Which edges to stroke on a face that faces the viewer: all, or a chosen list per face. */
  edges?: (face: number, visible: boolean[]) => [V3, V3][];
}

/** A box from two corners, as six faces. */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: (p: V3) => V3): V3[][] {
  const v = (x: number, y: number, z: number) => t([x, y, z]);
  const p = [
    v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0),
    v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1),
  ];
  return [
    [p[0], p[1], p[2], p[3]],
    [p[4], p[5], p[6], p[7]],
    [p[0], p[1], p[5], p[4]],
    [p[3], p[2], p[6], p[7]],
    [p[0], p[3], p[7], p[4]],
    [p[1], p[2], p[6], p[5]],
  ];
}

const centre = (pts: V3[]): V3 => {
  let x = 0, y = 0, z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x / pts.length, y / pts.length, z / pts.length];
};

/**
 * Paint solids far to near with back faces culled. `cam` is the camera's
 * distance in model units, `proj` maps a model point to the canvas.
 */
function paint(c: CanvasRenderingContext2D, solids: Solid[], cam: number, proj: (p: V3) => V2) {
  const order = solids
    .map((s) => ({ s, z: centre(s.faces.flat())[2] }))
    .sort((a, b) => a.z - b.z);
  for (const { s } of order) {
    const mid = centre(s.faces.flat());
    const visible = s.faces.map((f) => {
      // Outward normal, then whether it points towards the camera.
      const [a, b, cc] = f;
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const fc = centre(f);
      if (n[0] * (fc[0] - mid[0]) + n[1] * (fc[1] - mid[1]) + n[2] * (fc[2] - mid[2]) < 0) n = n.map((q) => -q);
      const view = [-fc[0], -fc[1], cam - fc[2]];
      return n[0] * view[0] + n[1] * view[1] + n[2] * view[2] > 0;
    });
    s.faces.forEach((f, i) => {
      if (!visible[i]) return;
      c.beginPath();
      f.forEach((p, k) => {
        const [x, y] = proj(p);
        if (k) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.closePath();
      c.fillStyle = FACE;
      c.fill();
      // Seal the seams between neighbouring faces so a smooth side shows no facets.
      c.strokeStyle = FACE;
      c.stroke();
      const edges = s.edges ? s.edges(i, visible) : f.map((p, k) => [p, f[(k + 1) % f.length]] as [V3, V3]);
      c.beginPath();
      for (const [p, q] of edges) {
        const a = proj(p), b = proj(q);
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
      }
      c.strokeStyle = EDGE;
      c.stroke();
    });
  }
}

function line(c: CanvasRenderingContext2D, proj: (p: V3) => V2, pts: V3[]) {
  c.beginPath();
  pts.forEach((p, k) => {
    const [x, y] = proj(p);
    if (k) c.lineTo(x, y);
    else c.moveTo(x, y);
  });
  c.strokeStyle = EDGE;
  c.stroke();
}

function unitText(c: CanvasRenderingContext2D, x: number, y: number, k: number, unit: number, alpha: number) {
  if (!unit) return;
  c.fillStyle = `rgba(${CHALK}, ${0.72 * alpha})`;
  c.font = `${Math.max(6.5, 8.5 * k).toFixed(1)}px ${CAD_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(unit), x, y);
}

/**
 * The moving head: a base hanging from the truss, a yoke that pans, and a
 * head that tilts. Returns where the lens sits on screen so the beam starts
 * there.
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
  /** Spotlight label: channel (the desk's fixture number) and unit number along the position. */
  channel: number;
  unit: number;
  labelY = 0;

  constructor(canvas: HTMLCanvasElement, channel = 0, unit = 0) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.channel = channel;
    this.unit = unit;
  }

  /** The canvas is sized to the scale; the clamp's top sits on the canvas's top edge. */
  resize(scale: number) {
    this.scale = scale;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = Math.ceil(240 * scale);
    this.pivotX = this.w / 2;
    this.pivotY = 118 * scale;
    // Room underneath for the Spotlight label: every unit's channel circle on one line.
    const r = Math.max(6.5, 8 * scale);
    this.labelY = this.pivotY + 62 * scale + r + 2;
    this.h = Math.ceil(this.labelY + r + 3);
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
    c.lineWidth = 0.9;
    c.globalAlpha = Math.max(0, Math.min(1, this.progress * 1.4 - 0.1));

    const cam = 520;
    const proj = ([x, y, z]: V3): V2 => {
      const f = cam / (cam - z * k);
      return [this.pivotX + x * k * f, this.pivotY + y * k * f];
    };
    const cp = Math.cos(pan), sp = Math.sin(pan);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const yaw = ([x, y, z]: V3): V3 => [x * cp - z * sp, y, x * sp + z * cp];
    const pitch = ([x, y, z]: V3): V3 => [x, y * ct - z * st, y * st + z * ct];
    const head = (p: V3) => yaw(pitch(p));
    const still = (p: V3) => p;

    // Clamp on the truss and the pan stem.
    line(c, proj, [[0, -118, 0], [0, -96, 0]]);
    line(c, proj, [[-9, -118, 0], [9, -118, 0]]);

    const bx = 34, by0 = -96, by1 = -78, bz = 26;
    const ya = 36, yTop = by1 + 4, arm = 4, depth = 3.5;
    const solids: Solid[] = [
      { faces: box(-bx, by0, -bz, bx, by1, bz, still) },
      // Yoke: two arms and the crossbar, turning with pan.
      { faces: box(-ya, yTop, -depth, ya, yTop + arm, depth, yaw) },
      { faces: box(-ya, yTop + arm, -depth, -ya + arm, 6, depth, yaw) },
      { faces: box(ya - arm, yTop + arm, -depth, ya, 6, depth, yaw) },
    ];

    // Head: a tapered cylinder along -z before tilt and pan. Smooth sides
    // show only their rims and silhouette.
    const R = 27, zBack = 22, zFront = -34, N = 24;
    const ring = (z: number, r: number) =>
      Array.from({ length: N }, (_, i) => head([Math.cos((i / N) * Math.PI * 2) * r, Math.sin((i / N) * Math.PI * 2) * r, z]));
    const back = ring(zBack, R * 0.86), front = ring(zFront, R), lens = ring(zFront - 1, R * 0.68);
    const sides = Array.from({ length: N }, (_, i) => [back[i], back[(i + 1) % N], front[(i + 1) % N], front[i]]);
    solids.push({
      faces: [...sides, back, front],
      edges: (fi, vis) => {
        if (fi === N) return back.map((p, i) => [p, back[(i + 1) % N]]);
        if (fi === N + 1) {
          const rim = front.map((p, i) => [p, front[(i + 1) % N]] as [V3, V3]);
          return [...rim, ...lens.map((p, i) => [p, lens[(i + 1) % N]] as [V3, V3])];
        }
        const out: [V3, V3][] = [];
        // Rims where the side meets a cap the camera can't see.
        if (!vis[N]) out.push([back[fi], back[(fi + 1) % N]]);
        if (!vis[N + 1]) out.push([front[fi], front[(fi + 1) % N]]);
        // Silhouette: where the side turns away from the camera.
        if (!vis[(fi + N - 1) % N]) out.push([back[fi], front[fi]]);
        if (!vis[(fi + 1) % N]) out.push([back[(fi + 1) % N], front[(fi + 1) % N]]);
        return out;
      },
    });
    paint(c, solids, cam / k, proj);

    // The lens shows its light only when it faces the camera.
    const lensC = proj(head([0, 0, zFront - 1]));
    const facing = head([0, 0, -1])[2] > 0.05;
    if (facing && level > 0.01 && this.progress >= 1) {
      const [r, g, b] = colour;
      const lp = lens.map(proj);
      c.beginPath();
      lp.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${0.85 * level})`;
      c.fill();
    }

    const labelA = Math.max(0, (this.progress - 0.7) / 0.3);
    const [ux, uy] = proj([0, (by0 + by1) / 2, bz]);
    unitText(c, ux, uy, k, this.unit, labelA);
    if (this.channel) drawFixtureLabel(c, this.pivotX, this.labelY, k, this.channel, labelA);
    c.globalAlpha = 1;
    return { x: lensC[0], y: lensC[1] };
  }
}

/**
 * A soft LED panel in a yoke, hung pointing down with its face tipped a
 * little towards the audience. The diffuser glows when it's on.
 */
export class PanelFixture {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  w = 240;
  h = 190;
  pivotX = 120;
  pivotY = 118;
  scale = 1;
  progress = 1;
  /** Half the width of the glowing face on screen, for the width of the beam. */
  lensHalfWidth = 40;
  channel: number;
  unit: number;
  labelY = 0;

  constructor(canvas: HTMLCanvasElement, channel = 0, unit = 0) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.channel = channel;
    this.unit = unit;
  }

  resize(scale: number) {
    this.scale = scale;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = Math.ceil(240 * scale);
    this.pivotX = this.w / 2;
    this.pivotY = 118 * scale;
    const r = Math.max(6.5, 8 * scale);
    this.labelY = this.pivotY + 62 * scale + r + 2;
    this.h = Math.ceil(this.labelY + r + 3);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  pivotOnScreen() {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + this.pivotX, y: r.top + this.pivotY };
  }

  draw(level: number, colour: [number, number, number]) {
    const c = this.ctx;
    const k = this.scale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 0.9;
    c.globalAlpha = Math.max(0, Math.min(1, this.progress * 1.4 - 0.1));

    const cam = 520;
    const proj = ([x, y, z]: V3): V2 => {
      const f = cam / (cam - z * k);
      return [this.pivotX + x * k * f, this.pivotY + y * k * f];
    };
    const a = 0.42; // face tipped towards the audience
    const ca = Math.cos(a), sa = Math.sin(a);
    const tip = ([x, y, z]: V3): V3 => [x, y * ca - z * sa, y * sa + z * ca];
    const still = (p: V3) => p;

    // Clamp.
    line(c, proj, [[0, -118, 0], [0, -96, 0]]);
    line(c, proj, [[-9, -118, 0], [9, -118, 0]]);

    // Yoke as solid bars, the panel body as a box on the trunnions.
    const bar = 3;
    const bx = 48, by = 7, bz = 30;
    const solids: Solid[] = [
      { faces: box(-56, -96, -bar, 56, -96 + bar * 1.4, bar, still) },
      { faces: box(-56 - bar, -96, -bar, -56 + bar * 0.2, 0, bar, still) },
      { faces: box(56 - bar * 0.2, -96, -bar, 56 + bar, 0, bar, still) },
      { faces: box(-bx, -by, -bz, bx, by, bz, tip) },
    ];
    paint(c, solids, cam / k, proj);

    // Diffuser frame inset on the face (the face towards the audience).
    const inset = 0.84;
    const face: V3[] = [
      [-bx * inset, by, -bz * inset], [bx * inset, by, -bz * inset],
      [bx * inset, by, bz * inset], [-bx * inset, by, bz * inset],
    ].map((p) => tip(p as V3));
    const fp = face.map(proj);
    line(c, proj, [...face, face[0]]);
    const centreP = proj(tip([0, by, 0]));
    this.lensHalfWidth = Math.abs(fp[1][0] - fp[0][0]) / 2;
    if (level > 0.01 && this.progress >= 1) {
      const [r, g, b] = colour;
      c.beginPath();
      fp.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${0.8 * level})`;
      c.fill();
    }

    const labelA = Math.max(0, (this.progress - 0.7) / 0.3);
    // Unit number on the panel's front edge, as the spots carry theirs on the base.
    const [ux, uy] = proj(tip([0, 0, bz]));
    unitText(c, ux, uy, k, this.unit, labelA);
    if (this.channel) drawFixtureLabel(c, this.pivotX, this.labelY, k, this.channel, labelA);
    c.globalAlpha = 1;
    return { x: centreP[0], y: centreP[1] };
  }
}
