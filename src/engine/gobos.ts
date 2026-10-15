/**
 * Pool masks drawn once per gobo: white where light lands, transparent where
 * it doesn't, with a soft focus edge. Plates draw these through a transform
 * to shape the pool, then use them as a mask for the photo underneath.
 */
export const SPRITE = 512;

function makeCanvas(size = SPRITE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Small deterministic random, so the breakup gobo is the same every load. */
function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * A real spot is hottest in the middle and falls off towards the field edge
 * before the focus edge cuts it, so the disc is a slope, not a plateau.
 */
function softDisc(ctx: CanvasRenderingContext2D, inner: number, outer = 1) {
  const h = SPRITE / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h * outer);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(inner * 0.45, 'rgba(255,255,255,0.97)');
  g.addColorStop(inner * 0.8, 'rgba(255,255,255,0.86)');
  g.addColorStop(inner, 'rgba(255,255,255,0.74)');
  g.addColorStop(inner + (1 - inner) * 0.5, 'rgba(255,255,255,0.3)');
  g.addColorStop(inner + (1 - inner) * 0.8, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
}

function pattern(ctx: CanvasRenderingContext2D, gobo: number) {
  const h = SPRITE / 2;
  ctx.fillStyle = '#fff';
  if (gobo === 1) {
    // Breakup: a scatter of leaf-like openings.
    const r = rand(7);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, SPRITE, SPRITE);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * h * 0.95;
      const x = h + Math.cos(a) * d, y = h + Math.sin(a) * d;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * Math.PI);
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 + r() * 34, 5 + r() * 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (gobo === 2) {
    // Dots: concentric rings of round openings.
    ctx.beginPath();
    ctx.arc(h, h, 20, 0, Math.PI * 2);
    ctx.fill();
    for (let ring = 1; ring <= 5; ring++) {
      const rr = ring * 46;
      const n = ring * 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.4;
        ctx.beginPath();
        ctx.arc(h + Math.cos(a) * rr, h + Math.sin(a) * rr, 15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (gobo === 3) {
    // Ring: a bright annulus with a dim centre.
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, SPRITE, SPRITE);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 62;
    ctx.beginPath();
    ctx.arc(h, h, h * 0.68, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillRect(0, 0, SPRITE, SPRITE);
  }
}

export interface GoboSprites {
  pool: HTMLCanvasElement[];
  halo: HTMLCanvasElement;
  /** Bumps whenever focus or frost rebuild the masks. */
  version: number;
}

let version = 0;

/** The halo doesn't depend on focus or frost, so every set shares one. */
let sharedHalo: HTMLCanvasElement | null = null;
function halo() {
  if (sharedHalo) return sharedHalo;
  const c = makeCanvas();
  const hc = c.getContext('2d')!;
  const h = SPRITE / 2;
  const g = hc.createRadialGradient(h, h, 0, h, h, h);
  // Lines and type catch light well past the pool, fading out slowly.
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  hc.fillStyle = g;
  hc.fillRect(0, 0, SPRITE, SPRITE);
  return (sharedHalo = c);
}

/** Safari has no canvas filter, so it gets its blur by scaling down and back up. */
let filterOk: boolean | null = null;
function canFilter(ctx: CanvasRenderingContext2D) {
  if (filterOk == null) {
    ctx.filter = 'blur(2px)';
    filterOk = ctx.filter === 'blur(2px)';
    ctx.filter = 'none';
  }
  return filterOk;
}

let scratch: HTMLCanvasElement | null = null;
let small: HTMLCanvasElement | null = null;

function blurInto(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, px: number) {
  scratch ??= makeCanvas();
  const t = scratch.getContext('2d')!;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, SPRITE, SPRITE);
  if (canFilter(t)) {
    t.filter = `blur(${px.toFixed(1)}px)`;
    t.drawImage(src, 0, 0);
    t.filter = 'none';
  } else {
    // Downscale by about the blur radius, then smooth it back up.
    const k = Math.max(1, Math.min(16, px * 0.9));
    const w = Math.max(8, Math.round(SPRITE / k));
    small ??= document.createElement('canvas');
    small.width = small.height = w;
    const sc = small.getContext('2d')!;
    sc.imageSmoothingEnabled = true;
    sc.imageSmoothingQuality = 'high';
    sc.clearRect(0, 0, w, w);
    sc.drawImage(src, 0, 0, w, w);
    t.imageSmoothingEnabled = true;
    t.imageSmoothingQuality = 'high';
    t.drawImage(small, 0, 0, SPRITE, SPRITE);
  }
  ctx.clearRect(0, 0, SPRITE, SPRITE);
  ctx.drawImage(scratch, 0, 0);
}

/**
 * focus 1 is a hard edge with crisp gobos, 0 is soft. Frost diffuses both
 * the edge and the gobo pattern.
 */
export function buildSprites(focus = 0.7, frost = 0): GoboSprites {
  const blur = 1 + (1 - focus) * 7 + frost * 14;
  const inner = Math.max(0.12, Math.min(0.86, 0.3 + 0.55 * focus - 0.35 * frost));
  const pool = [0, 1, 2, 3].map((g) => {
    const c = makeCanvas();
    const ctx = c.getContext('2d')!;
    pattern(ctx, g);
    if (g !== 0) blurInto(ctx, c, blur);
    ctx.globalCompositeOperation = 'destination-in';
    softDisc(ctx, inner);
    return c;
  });
  return { pool, halo: halo(), version: ++version };
}

/** Free a set's canvases now rather than whenever the garbage collector gets to them (iOS counts them against a hard limit). */
export function releaseSprites(s: GoboSprites) {
  for (const c of s.pool) c.width = c.height = 0;
}
