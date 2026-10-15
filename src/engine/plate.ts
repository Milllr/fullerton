import type { Pool } from './rig';
import { SPRITE } from './gobos';
import { setVar } from './css';
import { CAD, drawSheet, sheetInset, type SheetInfo } from './drafting';
import { imageUrl, sketchUrl, type ShowImage } from '../data/shows';

export interface SketchData {
  w: number;
  h: number;
  aspect: number;
  segs: number[][];
  fx: (string | number)[][];
}

const sketchCache = new Map<string, Promise<SketchData>>();
export function loadSketch(slug: string, id: string) {
  const key = `${slug}/${id}`;
  let p = sketchCache.get(key);
  if (!p) {
    p = fetch(sketchUrl(slug, id)).then((r) => {
      if (!r.ok) throw new Error(`Sketch ${key}: HTTP ${r.status}`);
      return r.json() as Promise<SketchData>;
    });
    // A failed download isn't remembered, so the next try fetches again.
    p.catch(() => sketchCache.get(key) === p && sketchCache.delete(key));
    sketchCache.set(key, p);
  }
  return p;
}

/** Shared scratch surface: each spot's light is built here, then laid onto the plate. */
let scratch: HTMLCanvasElement | null = null;
function getScratch(w: number, h: number) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < w) scratch.width = w;
  if (scratch.height < h) scratch.height = h;
  return scratch;
}

/** One spot's light as it lands on the page this frame. */
export interface SpotLight {
  pool: Pool;
  /** Intensity where the pool lands, 0..1. */
  I: number;
  /** Multiply tint for the photo, and the colour the sketch lines catch. */
  tint: string;
  halo: string;
  /** The pool's gobo mask and its soft halo. */
  mask: HTMLCanvasElement;
  haloMask: HTMLCanvasElement;
  spin: number;
  /** Changes whenever the mask's contents change. */
  key: string;
}

/** A soft panel's field on the page. */
export interface Flood {
  pool: Pool;
  I: number;
  /** Relative illuminance 0..1 at a point. */
  at: (x: number, y: number) => number;
}

/** Line colour for everything drawn as CAD: Vectorworks white on black. */
export const CHALK = CAD;

interface Mapping {
  ox: number;
  oy: number;
  s: number;
}

/**
 * Draws a set the way Vectorworks shows a Hidden Line render on its black
 * background: every edge one crisp, even line, no hand drawn overshoot.
 * Unlit, the drawing sits back like a greyed layer; under the light it's
 * the active layer, full white. Light sources in the photo are the set's
 * own fixtures, drawn as plain outlines.
 */
export function drawSketch(
  ctx: CanvasRenderingContext2D,
  data: SketchData,
  m: Mapping,
  opts: { progress?: number; bright?: boolean; order?: number[]; weight?: number } = {},
) {
  const { progress = 1, bright = false, order } = opts;
  const weight = opts.weight ?? 1;
  const segs = data.segs;
  const n = Math.floor(segs.length * progress);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = bright ? 1 : 0.8;
  // One path, one stroke: where segments meet or overlap they don't double up.
  const edges = new Path2D();
  for (let k = 0; k < n; k++) {
    const [x1, y1, x2, y2] = segs[order ? order[k] : k];
    edges.moveTo(m.ox + x1 * m.s, m.oy + y1 * m.s);
    edges.lineTo(m.ox + x2 * m.s, m.oy + y2 * m.s);
  }
  const a = bright ? 0.92 : Math.min(1, 0.3 * weight);
  ctx.strokeStyle = `rgba(${bright ? '255, 255, 255' : CHALK}, ${a})`;
  ctx.stroke(edges);
  if (progress > 0.6) {
    const fxAlpha = Math.min(1, (progress - 0.6) / 0.4);
    const sym = new Path2D();
    for (const f of data.fx) {
      const cx = m.ox + (f[1] as number) * m.s;
      const cy = m.oy + (f[2] as number) * m.s;
      if (f[0] === 'c') {
        const r = Math.max(1.6, (f[3] as number) * m.s);
        sym.moveTo(cx + r, cy);
        sym.arc(cx, cy, r, 0, Math.PI * 2);
      } else {
        const hw = (f[3] as number) * m.s, hh = (f[4] as number) * m.s;
        sym.rect(cx - hw, cy - hh, hw * 2, hh * 2);
      }
    }
    ctx.strokeStyle = `rgba(${bright ? '255, 255, 255' : CHALK}, ${a * fxAlpha})`;
    ctx.stroke(sym);
  }
}

export function coverMapping(W: number, H: number, aspect: number, focusY = 0.5): Mapping {
  const s = Math.max(W, H / aspect);
  return { s, ox: (W - s) / 2, oy: (H - s * aspect) * focusY };
}

export class Plate {
  readonly el: HTMLElement;
  readonly stage: HTMLElement;
  readonly slug: string;
  readonly image: ShowImage;
  readonly aspect: number;
  readonly focusY: number;
  private sketchC: HTMLCanvasElement;
  private lightC: HTMLCanvasElement;
  /** The sheet's drafting (border, centre line, focus points, title block), over everything. */
  private notesC: HTMLCanvasElement;
  readonly sheet: SheetInfo | null;
  private sctx: CanvasRenderingContext2D;
  private lctx: CanvasRenderingContext2D;
  private brightC: HTMLCanvasElement | null = null;
  readonly img: HTMLImageElement;
  data: SketchData | null = null;
  order: number[] = [];
  private photoReady = false;
  private loading = false;
  rect = new DOMRect();
  near = false;
  visible = false;
  dpr = 1;
  progress = 1;
  private prevBox: number[] | null = null;
  private lastSig = '';
  private map: Mapping = { ox: 0, oy: 0, s: 1 };

  readonly weight: number;

  constructor(el: HTMLElement, slug: string, image: ShowImage, focusY = 0.5, weight = 1, sheet: SheetInfo | null = null) {
    this.el = el;
    this.sheet = sheet;
    this.weight = weight;
    this.slug = slug;
    this.image = image;
    this.focusY = focusY;
    this.aspect = image.h / image.w;
    this.stage = el.querySelector('.plate-stage')!;
    this.img = el.querySelector('img')!;
    this.sketchC = document.createElement('canvas');
    this.lightC = document.createElement('canvas');
    this.sketchC.className = 'plate-sketch';
    this.lightC.className = 'plate-light';
    this.sketchC.setAttribute('aria-hidden', 'true');
    this.lightC.setAttribute('aria-hidden', 'true');
    this.notesC = document.createElement('canvas');
    this.notesC.className = 'plate-notes';
    this.notesC.setAttribute('aria-hidden', 'true');
    this.stage.append(this.sketchC, this.lightC, this.notesC);
    this.sctx = this.sketchC.getContext('2d')!;
    this.lctx = this.lightC.getContext('2d')!;
    // The photo itself sits under the sketch and only shows where light spills.
    this.img.style.objectPosition = `50% ${focusY * 100}%`;
  }

  /** A tiny copy of the photo, for working out what colour bounces off the set. */
  private thumb: Uint8ClampedArray | null = null;
  private tw = 0;
  private th = 0;

  private buildThumb() {
    try {
      this.tw = 24;
      this.th = Math.max(4, Math.round(24 * this.aspect));
      const c = document.createElement('canvas');
      c.width = this.tw;
      c.height = this.th;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(this.img, 0, 0, this.tw, this.th);
      this.thumb = x.getImageData(0, 0, this.tw, this.th).data;
    } catch {
      this.thumb = null;
    }
  }

  /**
   * Average colour of the set under and around the pool, weighted towards
   * brighter surfaces, which bounce more. Returns null when the pool is off
   * this plate.
   */
  sampleBounce(pool: Pool): [number, number, number, number] | null {
    if (!this.thumb) return null;
    const r = this.rect;
    const m = this.map;
    // Pool centre in normalised photo coordinates.
    const nx = (pool.x - r.left - m.ox) / m.s;
    const ny = (pool.y - r.top - m.oy) / (m.s * this.aspect);
    const rad = (Math.max(pool.rx, pool.ry) * 1.4) / m.s;
    if (nx < -rad || nx > 1 + rad || ny < -rad || ny > 1 + rad) return null;
    let R = 0, G = 0, B = 0, W = 0;
    for (let y = 0; y < this.th; y++) {
      for (let x = 0; x < this.tw; x++) {
        const fx = (x + 0.5) / this.tw, fy = (y + 0.5) / this.th;
        const dx = fx - nx, dy = (fy - ny) * this.aspect;
        const d2 = (dx * dx + dy * dy) / (rad * rad);
        if (d2 > 1) continue;
        const i = (y * this.tw + x) * 4;
        const lum = (this.thumb[i] * 0.3 + this.thumb[i + 1] * 0.59 + this.thumb[i + 2] * 0.11) / 255;
        const w = (1 - d2) * (0.15 + lum);
        R += this.thumb[i] * w;
        G += this.thumb[i + 1] * w;
        B += this.thumb[i + 2] * w;
        W += w;
      }
    }
    if (!W) return null;
    return [R / W / 255, G / W / 255, B / W / 255, W];
  }

  /**
   * Light that isn't the spots' pools: each spot's faint spill past its pool,
   * and the panels' broad, even fields. Both let the real photo through softly.
   */
  spill(spots: { pool: Pool; I: number }[], floods: Flood[]) {
    const st = this.stage;
    const r = this.rect;
    const on = this.photoReady;
    spots.forEach((sp, i) => {
      const n = i + 1;
      if (!on || sp.I < 0.004) {
        setVar(st, `--s${n}a`, '0');
        return;
      }
      const { pool } = sp;
      const big = Math.max(pool.rx, pool.ry), small = Math.min(pool.rx, pool.ry);
      setVar(st, `--s${n}x`, `${Math.round(pool.x - r.left)}px`);
      setVar(st, `--s${n}y`, `${Math.round(pool.y - r.top)}px`);
      setVar(st, `--s${n}rx`, `${Math.round(big * 2.7)}px`);
      setVar(st, `--s${n}ry`, `${Math.round(small * 2.7 + (big - small) * 1.2)}px`);
      setVar(st, `--s${n}a`, (0.2 * sp.I).toFixed(3));
    });
    let lit = 0;
    floods.forEach((f, i) => {
      const n = i + 1;
      if (!on || f.I < 0.004) {
        setVar(st, `--p${n}a`, '0');
        return;
      }
      setVar(st, `--p${n}x`, `${Math.round(f.pool.x - r.left)}px`);
      setVar(st, `--p${n}y`, `${Math.round(f.pool.y - r.top)}px`);
      setVar(st, `--p${n}rx`, `${Math.round(f.pool.rx)}px`);
      setVar(st, `--p${n}ry`, `${Math.round(f.pool.ry)}px`);
      setVar(st, `--p${n}a`, (0.95 * f.I).toFixed(3));
      // How lit the plate is as a whole, for easing the sketch back.
      const c = f.at(r.left + r.width / 2, r.top + r.height / 2) * f.I;
      lit = 1 - (1 - lit) * (1 - c);
    });
    setVar(st, '--pf', (on ? lit : 0).toFixed(3));
  }

  async load() {
    if (this.loading) return;
    this.loading = true;
    const want = this.stage.clientWidth * Math.min(2, devicePixelRatio || 1) > 1150 ? 'full' : 'm';
    const src = imageUrl(this.slug, this.image.id, want);
    // The page decides when to load, not the browser's lazy loading: Firefox
    // won't fetch a lazy image just because decode() was called on it.
    this.img.loading = 'eager';
    const ready = () => {
      if (this.photoReady || !this.img.naturalWidth) return;
      this.photoReady = true;
      this.lastSig = '';
      this.buildThumb();
    };
    this.img.addEventListener('load', ready);
    if (!this.img.src.endsWith(src)) this.img.src = src;
    if (this.img.complete) ready();
    this.img.decode().then(ready, () => {});
    // The sketch doesn't wait for the photo.
    try {
      const data = await loadSketch(this.slug, this.image.id);
      this.data = data;
      this.order = data.segs
        .map((s, i) => [Math.hypot(s[2] - s[0], s[3] - s[1]), i])
        .sort((a, b) => b[0] - a[0])
        .map((a) => a[1]);
      this.resize(true);
    } catch {
      // Try again the next time the plate comes near.
      this.loading = false;
    }
  }

  private sized = '';

  /** Size the canvases to the plate. Does nothing if the plate's size hasn't changed, unless forced. */
  resize(force = false) {
    const W = this.stage.clientWidth, H = this.stage.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const key = `${W}x${H}@${dpr}`;
    if (key === this.sized && !force) return;
    this.sized = key;
    this.dpr = dpr;
    for (const c of [this.sketchC, this.lightC]) {
      c.width = Math.round(W * this.dpr);
      c.height = Math.round(H * this.dpr);
    }
    this.map = coverMapping(W, H, this.aspect, this.focusY);
    this.prevBox = null;
    this.lastSig = '';
    if (this.sheet) {
      this.notesC.width = Math.round(W * this.dpr);
      this.notesC.height = Math.round(H * this.dpr);
      const nc = this.notesC.getContext('2d')!;
      nc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawSheet(nc, W, H, this.sheet);
    }
    this.renderSketch();
    if (this.data) {
      this.brightC ??= document.createElement('canvas');
      this.brightC.width = this.sketchC.width;
      this.brightC.height = this.sketchC.height;
      const b = this.brightC.getContext('2d')!;
      b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawSketch(b, this.data, this.map, { bright: true, order: this.order });
    }
  }

  renderSketch(progress = this.progress) {
    this.progress = progress;
    const c = this.sctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.sketchC.width, this.sketchC.height);
    if (!this.data) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawSketch(c, this.data, this.map, { progress, order: this.order, weight: this.weight });
  }

  measure() {
    this.rect = this.stage.getBoundingClientRect();
  }

  /** The drawn sheet's inner border on screen, from the last measure(). */
  innerRect() {
    if (!this.sheet) return null;
    const r = this.rect;
    const top = this.sheet.topInset?.() ?? 0;
    const H = r.height - (this.sheet.bottomInset?.() ?? 0) - top;
    const i = sheetInset(r.width, H);
    return { x0: r.left + i, y0: r.top + top + i, x1: r.right - i, y1: r.top + top + H - i, u: Math.max(6, Math.min(9.5, Math.min(r.width, H * 1.6) / 120)) };
  }

  clearLight() {
    this.lastSig = '';
    if (!this.prevBox) return;
    const [x, y, w, h] = this.prevBox;
    this.lctx.setTransform(1, 0, 0, 1, 0, 0);
    this.lctx.clearRect(x, y, w, h);
    this.prevBox = null;
  }

  /**
   * Paint this frame's spot light. Each spot reveals the photo through its own
   * gobo and colour; where two pools cross they add up like light does, by
   * screening, so the overlap is brighter without clipping. Assumes measure()
   * has been called this frame.
   */
  drawLight(lights: SpotLight[]) {
    const r = this.rect;
    const W = r.width, H = r.height;
    const live = lights
      .map((L) => {
        const lx = L.pool.x - r.left, ly = L.pool.y - r.top;
        const R = Math.max(L.pool.rx, L.pool.ry) * 2.2;
        return { L, lx, ly, x0: Math.max(0, lx - R), y0: Math.max(0, ly - R), x1: Math.min(W, lx + R), y1: Math.min(H, ly + R) };
      })
      .filter((o) => o.x1 > o.x0 && o.y1 > o.y0 && o.L.I >= 0.004);
    // Nothing moved since last frame: keep what's painted.
    const sig =
      live
        .map(({ L, lx, ly }) => `${lx.toFixed(1)},${ly.toFixed(1)},${L.pool.rx.toFixed(1)},${L.pool.ry.toFixed(2)},${L.pool.angle.toFixed(3)},${L.I.toFixed(3)},${L.tint},${L.key},${L.spin.toFixed(3)}`)
        .join('|') + `|${W},${H},${this.photoReady}`;
    if (sig === this.lastSig) return;
    this.clearLight();
    this.lastSig = sig;
    if (!live.length || !this.data) return;
    const d = this.dpr;
    const boxOf = (o: (typeof live)[number]) => [Math.floor(o.x0 * d), Math.floor(o.y0 * d), Math.ceil((o.x1 - o.x0) * d) + 2, Math.ceil((o.y1 - o.y0) * d) + 2];
    const boxes = live.map(boxOf);
    // The photo only shows inside the pool's own sprite, so its passes cover
    // the pool, not the much wider halo: about a fifth of the pixels.
    const poolBoxes = live.map((o) => {
      const R = Math.max(o.L.pool.rx, o.L.pool.ry) * 1.04;
      const x0 = Math.max(0, o.lx - R), y0 = Math.max(0, o.ly - R), x1 = Math.min(W, o.lx + R), y1 = Math.min(H, o.ly + R);
      return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1, box: [Math.floor(x0 * d), Math.floor(y0 * d), Math.ceil((x1 - x0) * d) + 2, Math.ceil((y1 - y0) * d) + 2] } : null;
    });
    const ux0 = Math.min(...boxes.map((b) => b[0])), uy0 = Math.min(...boxes.map((b) => b[1]));
    const ux1 = Math.max(...boxes.map((b) => b[0] + b[2])), uy1 = Math.max(...boxes.map((b) => b[1] + b[3]));
    this.prevBox = [ux0, uy0, ux1 - ux0, uy1 - uy0];

    const ctx = this.lctx;
    const s = getScratch(this.lightC.width, this.lightC.height);
    const sc = s.getContext('2d')!;
    const k = SPRITE / 2;
    const place = (c: CanvasRenderingContext2D, o: (typeof live)[number], f: number) => {
      c.translate(o.lx, o.ly);
      c.rotate(o.L.pool.angle);
      c.scale((o.L.pool.rx * f) / k, (o.L.pool.ry * f) / k);
    };
    const begin = (box: number[]) => {
      sc.save();
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      sc.globalAlpha = 1;
      sc.clearRect(box[0], box[1], box[2], box[3]);
      sc.beginPath();
      sc.rect(box[0], box[1], box[2], box[3]);
      sc.clip();
      sc.setTransform(d, 0, 0, d, 0, 0);
    };
    const lay = (box: number[], op: GlobalCompositeOperation) => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = op;
      ctx.drawImage(s, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
      ctx.restore();
    };

    // The photo, lit by each spot in turn.
    if (this.photoReady) {
      const m = this.map;
      live.forEach((o, i) => {
        const pb = poolBoxes[i];
        if (!pb) return;
        const box = pb.box;
        begin(box);
        sc.drawImage(this.img, m.ox, m.oy, m.s, m.s * this.aspect);
        sc.globalCompositeOperation = 'multiply';
        sc.fillStyle = o.L.tint;
        sc.fillRect(pb.x0, pb.y0, pb.x1 - pb.x0, pb.y1 - pb.y0);
        sc.globalCompositeOperation = 'destination-in';
        sc.globalAlpha = Math.min(1, o.L.I * 1.08);
        place(sc, o, 1);
        sc.rotate(o.L.spin);
        sc.drawImage(o.L.mask, -k, -k);
        sc.restore();
        lay(box, 'screen');
      });
    }

    // Halo: the sketch catches light just beyond each pool's edge.
    if (this.brightC) {
      live.forEach((o, i) => {
        const box = boxes[i];
        begin(box);
        sc.setTransform(1, 0, 0, 1, 0, 0);
        sc.drawImage(this.brightC!, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
        sc.globalCompositeOperation = 'source-atop';
        sc.fillStyle = o.L.halo;
        sc.fillRect(box[0], box[1], box[2], box[3]);
        sc.globalCompositeOperation = 'destination-in';
        sc.globalAlpha = Math.min(1, o.L.I * 1.1);
        sc.setTransform(d, 0, 0, d, 0, 0);
        place(sc, o, 2.2);
        sc.drawImage(o.L.haloMask, -k, -k);
        sc.restore();
        lay(box, 'destination-over');
      });
    }
  }
}
