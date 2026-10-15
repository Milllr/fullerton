import { CAD, drawFocusPoint } from './drafting';
import type { Pool } from './rig';

/*
  Spotlight's "Draw Beam": each spot's beam drawn as a wireframe cone, the
  two edges from the lens to the field ellipse where it lands, with the beam
  angle as a dashed ellipse inside. Thin and faint, over the real light.
*/
export interface CadBeam {
  lens: { x: number; y: number };
  pool: Pool;
  /** Output 0..1; the drawing fades with the fixture. */
  I: number;
}

export class BeamCad {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private dirty: number[] | null = null;
  private sig = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(vw: number, vh: number) {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(vw * this.dpr);
    this.canvas.height = Math.round(vh * this.dpr);
    this.dirty = null;
    this.sig = '';
  }

  /**
   * `sheets` are the inner borders of the drawn sheets on screen: a beam's
   * ellipses are cropped to the sheet its focus lands on, as a viewport crops
   * what it shows. Each beam's aim gets a focus point.
   */
  draw(beams: CadBeam[], sheets: { x0: number; y0: number; x1: number; y1: number; u: number }[] = []) {
    const live = beams.filter((b) => b.I > 0.04);
    const sig =
      live.map((b) => `${b.lens.x.toFixed(1)},${b.lens.y.toFixed(1)},${b.pool.x.toFixed(1)},${b.pool.y.toFixed(1)},${b.pool.rx.toFixed(1)},${b.pool.ry.toFixed(1)},${b.pool.angle.toFixed(3)},${b.I.toFixed(2)}`).join('|') +
      sheets.map((r) => `${r.x0.toFixed(0)},${r.y0.toFixed(0)},${r.x1.toFixed(0)},${r.y1.toFixed(0)}`).join(';');
    if (sig === this.sig) return;
    this.sig = sig;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.dirty) c.clearRect(this.dirty[0], this.dirty[1], this.dirty[2], this.dirty[3]);
    this.dirty = null;
    if (!live.length) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of live) {
      const { pool: p, lens: L } = b;
      const a = 0.24 * Math.min(1, b.I * 1.2);
      const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
      const at = (t: number) => {
        const ex = p.rx * Math.cos(t), ey = p.ry * Math.sin(t);
        return { x: p.x + ex * ca - ey * sa, y: p.y + ex * sa + ey * ca };
      };
      const d = (t: number) => {
        const ex = -p.rx * Math.sin(t), ey = p.ry * Math.cos(t);
        return { x: ex * ca - ey * sa, y: ex * sa + ey * ca };
      };
      // The cone's edges touch the ellipse where the line from the lens is tangent to it.
      const f = (t: number) => {
        const P = at(t), D = d(t);
        return (P.x - L.x) * D.y - (P.y - L.y) * D.x;
      };
      const tangents: { x: number; y: number }[] = [];
      const N = 96;
      let prev = f(0);
      for (let k = 1; k <= N && tangents.length < 2; k++) {
        const t = (k / N) * Math.PI * 2;
        const cur = f(t);
        if ((prev < 0) !== (cur < 0)) {
          const t0 = ((k - 1) / N) * Math.PI * 2;
          tangents.push(at(t0 + ((t - t0) * prev) / (prev - cur)));
        }
        prev = cur;
      }
      // Everything is cropped to the sheet the focus lands on, as a viewport
      // crops what it shows; the haze carries the beam from the rig to it.
      const sheet = sheets.find((r) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1);
      c.save();
      if (sheet) {
        c.beginPath();
        c.rect(sheet.x0, sheet.y0, sheet.x1 - sheet.x0, sheet.y1 - sheet.y0);
        c.clip();
      }
      c.strokeStyle = `rgba(${CAD}, ${a})`;
      c.lineWidth = 0.75;
      c.setLineDash([]);
      c.beginPath();
      for (const T of tangents) {
        c.moveTo(L.x, L.y);
        c.lineTo(T.x, T.y);
      }
      c.stroke();
      // The field ellipse, and the beam angle (half as bright, about two thirds
      // of the field) dashed inside it.
      c.beginPath();
      c.ellipse(p.x, p.y, Math.max(1, p.rx), Math.max(1, p.ry), p.angle, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([5, 4]);
      c.strokeStyle = `rgba(${CAD}, ${a * 0.8})`;
      c.beginPath();
      c.ellipse(p.x, p.y, Math.max(1, p.rx * 0.64), Math.max(1, p.ry * 0.64), p.angle, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      c.setLineDash([]);
      const R = Math.max(p.rx, p.ry) + 2;
      x0 = Math.min(x0, p.x - R, L.x - 2);
      y0 = Math.min(y0, p.y - R, L.y - 2);
      x1 = Math.max(x1, p.x + R, L.x + 2);
      y1 = Math.max(y1, p.y + R, L.y + 2);
    }
    // Focus points where the beams are aimed: one when both spots share a
    // focus, two when they cross to different ones.
    const targets: { x: number; y: number; I: number; u: number }[] = [];
    for (const b of live) {
      const sheet = sheets.find((r) => b.pool.x >= r.x0 && b.pool.x <= r.x1 && b.pool.y >= r.y0 && b.pool.y <= r.y1);
      const u = sheet?.u ?? 9;
      // Aims closer than a few octagons apart read as one focus.
      const near = targets.find((t) => Math.hypot(t.x - b.pool.x, t.y - b.pool.y) < u * 1.5 * 3.2);
      if (near) near.I = Math.max(near.I, b.I);
      else targets.push({ x: b.pool.x, y: b.pool.y, I: b.I, u });
    }
    targets.forEach((t, i) => {
      const r = t.u * 1.5;
      drawFocusPoint(c, Math.round(t.x) + 0.5, Math.round(t.y) + 0.5, r, `FP${i + 1}`, Math.min(1, t.I * 1.2));
      x0 = Math.min(x0, t.x - r - 2);
      y0 = Math.min(y0, t.y - r * 2 - 4);
      x1 = Math.max(x1, t.x + r * 3 + 30);
      y1 = Math.max(y1, t.y + r + 2);
    });
    const k = this.dpr;
    this.dirty = [Math.floor(x0 * k) - 2, Math.floor(y0 * k) - 2, Math.ceil((x1 - x0) * k) + 4, Math.ceil((y1 - y0) * k) + 4];
  }
}
