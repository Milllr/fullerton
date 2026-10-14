import type { Pool, Rig } from './rig';
import { SPRITE, type GoboSprites } from './gobos';
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
    p = fetch(sketchUrl(slug, id)).then((r) => r.json());
    sketchCache.set(key, p);
  }
  return p;
}

/** Shared scratch surface for the halo pass. */
let scratch: HTMLCanvasElement | null = null;
function getScratch(w: number, h: number) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < w) scratch.width = w;
  if (scratch.height < h) scratch.height = h;
  return scratch;
}

export const CHALK = '214, 204, 188';

interface Mapping {
  ox: number;
  oy: number;
  s: number;
}

/**
 * Draws a set as a hairline sketch, then lets the real photograph through
 * wherever the beam's pool lands on it.
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
  ctx.lineWidth = bright ? 1.15 : 0.85;
  // Bucket by alpha so we stroke a handful of paths instead of thousands.
  const buckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const ext = 2.2 / m.s; // drafting overshoot, in normalised units
  for (let k = 0; k < n; k++) {
    const sg = segs[order ? order[k] : k];
    const [x1, y1, x2, y2] = sg;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / (len || 1), uy = (y2 - y1) / (len || 1);
    const b = Math.min(3, Math.floor((len / 0.18) * 4));
    const p = buckets[b];
    p.moveTo(m.ox + (x1 - ux * ext) * m.s, m.oy + (y1 - uy * ext) * m.s);
    p.lineTo(m.ox + (x2 + ux * ext) * m.s, m.oy + (y2 + uy * ext) * m.s);
  }
  const alphas = bright ? [0.55, 0.7, 0.85, 1] : [0.13, 0.19, 0.26, 0.34];
  buckets.forEach((p, i) => {
    ctx.strokeStyle = bright ? `rgba(255,255,255,${alphas[i]})` : `rgba(${CHALK}, ${alphas[i] * weight})`;
    ctx.stroke(p);
  });
  // Light sources in the photo become fixture symbols.
  if (progress > 0.6) {
    const fxAlpha = Math.min(1, (progress - 0.6) / 0.4);
    const sym = new Path2D();
    const fill = new Path2D();
    for (const f of data.fx) {
      const cx = m.ox + (f[1] as number) * m.s;
      const cy = m.oy + (f[2] as number) * m.s;
      if (f[0] === 'c') {
        const r = Math.max(1.6, (f[3] as number) * m.s);
        sym.moveTo(cx + r, cy);
        sym.arc(cx, cy, r, 0, Math.PI * 2);
        fill.moveTo(cx + r * 0.55, cy);
        fill.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      } else {
        const hw = (f[3] as number) * m.s, hh = (f[4] as number) * m.s;
        sym.rect(cx - hw, cy - hh, hw * 2, hh * 2);
        fill.rect(cx - hw * 0.6, cy - hh * 0.6, hw * 1.2, hh * 1.2);
      }
    }
    if (bright) {
      ctx.fillStyle = `rgba(255,255,255,${fxAlpha})`;
      ctx.fill(fill);
      ctx.strokeStyle = `rgba(255,255,255,${fxAlpha})`;
    } else {
      ctx.strokeStyle = `rgba(${CHALK}, ${0.42 * fxAlpha * weight})`;
    }
    ctx.lineWidth = 0.8;
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

  constructor(el: HTMLElement, slug: string, image: ShowImage, focusY = 0.5, weight = 1) {
    this.el = el;
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
    this.stage.append(this.sketchC, this.lightC);
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

  /** Faint light leaking past the pool: the real photo shows through, dimly. */
  spill(pool: Pool, I: number) {
    const st = this.stage.style;
    if (I < 0.004 || !this.photoReady) {
      st.setProperty('--sa', '0');
      return;
    }
    const r = this.rect;
    st.setProperty('--sx', `${Math.round(pool.x - r.left)}px`);
    st.setProperty('--sy', `${Math.round(pool.y - r.top)}px`);
    const big = Math.max(pool.rx, pool.ry);
    st.setProperty('--srx', `${Math.round(big * 2.7)}px`);
    st.setProperty('--sry', `${Math.round(Math.min(pool.rx, pool.ry) * 2.7 + (big - Math.min(pool.rx, pool.ry)) * 1.2)}px`);
    st.setProperty('--sa', (0.2 * I).toFixed(3));
  }

  async load() {
    if (this.loading) return;
    this.loading = true;
    const want = this.stage.clientWidth * Math.min(2, devicePixelRatio || 1) > 1150 ? 'full' : 'm';
    const src = imageUrl(this.slug, this.image.id, want);
    if (!this.img.src.endsWith(src)) this.img.src = src;
    const [data] = await Promise.all([
      loadSketch(this.slug, this.image.id),
      this.img.decode().then(
        () => {
          this.photoReady = true;
          this.buildThumb();
        },
        () => (this.photoReady = false),
      ),
    ]);
    this.data = data;
    this.order = data.segs
      .map((s, i) => [Math.hypot(s[2] - s[0], s[3] - s[1]), i])
      .sort((a, b) => b[0] - a[0])
      .map((a) => a[1]);
    this.resize();
  }

  resize() {
    const W = this.stage.clientWidth, H = this.stage.clientHeight;
    if (!W || !H) return;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [this.sketchC, this.lightC]) {
      c.width = Math.round(W * this.dpr);
      c.height = Math.round(H * this.dpr);
    }
    this.map = coverMapping(W, H, this.aspect, this.focusY);
    this.prevBox = null;
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

  clearLight() {
    this.lastSig = '';
    if (!this.prevBox) return;
    const [x, y, w, h] = this.prevBox;
    this.lctx.setTransform(1, 0, 0, 1, 0, 0);
    this.lctx.clearRect(x, y, w, h);
    this.prevBox = null;
  }

  /** Paint this frame's light. Assumes measure() has been called this frame. */
  drawLight(pool: Pool, rig: Rig, sprites: GoboSprites, tint: string, halo: string) {
    const r = this.rect;
    const W = r.width, H = r.height;
    const lx = pool.x - r.left, ly = pool.y - r.top;
    const I = rig.poolI;
    const R = Math.max(pool.rx, pool.ry) * 2.2;
    const x0 = Math.max(0, lx - R), y0 = Math.max(0, ly - R);
    const x1 = Math.min(W, lx + R), y1 = Math.min(H, ly + R);
    // Nothing moved since last frame: keep what's painted.
    const sig = `${lx.toFixed(1)},${ly.toFixed(1)},${pool.rx.toFixed(1)},${pool.ry.toFixed(2)},${pool.angle.toFixed(3)},${I.toFixed(3)},${tint},${rig.out.gobo},${sprites.version},${rig.goboSpin.toFixed(3)},${W},${H},${this.photoReady}`;
    if (sig === this.lastSig && this.prevBox) return;
    this.lastSig = sig;
    this.clearLight();
    if (x1 <= x0 || y1 <= y0 || I < 0.004 || !this.data) return;
    const d = this.dpr;
    const box = [Math.floor(x0 * d), Math.floor(y0 * d), Math.ceil((x1 - x0) * d) + 2, Math.ceil((y1 - y0) * d) + 2];
    this.prevBox = box;
    const ctx = this.lctx;
    const k = SPRITE / 2;
    const placeSprite = (c: CanvasRenderingContext2D, sx: number, sy: number) => {
      c.translate(lx, ly);
      c.rotate(pool.angle);
      c.scale((pool.rx * sx) / k, (pool.ry * sy) / k);
    };

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(box[0], box[1], box[2], box[3]);
    ctx.clip();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (this.photoReady) {
      const m = this.map;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.img, m.ox, m.oy, m.s, m.s * this.aspect);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = tint;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.globalAlpha = Math.min(1, I * 1.08);
      placeSprite(ctx, 1, 1);
      ctx.rotate(rig.goboSpin);
      ctx.drawImage(sprites.pool[rig.out.gobo], -k, -k);
    }
    ctx.restore();

    // Halo: the sketch catches light just beyond the pool's edge.
    if (this.brightC) {
      const s = getScratch(this.lightC.width, this.lightC.height);
      const sc = s.getContext('2d')!;
      sc.save();
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = 'copy';
      sc.drawImage(this.brightC, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
      sc.globalCompositeOperation = 'source-atop';
      sc.fillStyle = halo;
      sc.fillRect(box[0], box[1], box[2], box[3]);
      sc.globalCompositeOperation = 'destination-in';
      sc.globalAlpha = Math.min(1, I * 1.1);
      sc.beginPath();
      sc.rect(box[0], box[1], box[2], box[3]);
      sc.clip();
      sc.setTransform(d, 0, 0, d, 0, 0);
      placeSprite(sc, 2.2, 2.2);
      sc.drawImage(sprites.halo, -k, -k);
      sc.restore();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(s, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
      ctx.restore();
    }
  }
}
