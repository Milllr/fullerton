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

function softDisc(ctx: CanvasRenderingContext2D, inner: number, outer = 1) {
  const h = SPRITE / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h * outer);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(inner, 'rgba(255,255,255,1)');
  g.addColorStop(inner + (1 - inner) * 0.55, 'rgba(255,255,255,0.35)');
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
}

export function buildSprites(): GoboSprites {
  const pool = [0, 1, 2, 3].map((g) => {
    const c = makeCanvas();
    const ctx = c.getContext('2d')!;
    pattern(ctx, g);
    // Blur the pattern slightly: gobos are never perfectly in focus.
    if (g !== 0) {
      const t = makeCanvas();
      const tc = t.getContext('2d')!;
      tc.filter = 'blur(3px)';
      tc.drawImage(c, 0, 0);
      ctx.clearRect(0, 0, SPRITE, SPRITE);
      ctx.drawImage(t, 0, 0);
    }
    ctx.globalCompositeOperation = 'destination-in';
    softDisc(ctx, 0.62);
    return c;
  });
  const halo = makeCanvas();
  const hc = halo.getContext('2d')!;
  const h = SPRITE / 2;
  const g = hc.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  hc.fillStyle = g;
  hc.fillRect(0, 0, SPRITE, SPRITE);
  return { pool, halo };
}
