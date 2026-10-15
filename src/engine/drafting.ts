/*
  Spotlight drafting, drawn the way Vectorworks shows a sheet layer on its
  black background: a title block border with grid zones, a centre line, a
  drawing label and a title block, in white uppercase Arial at USITT line
  weights scaled to the screen (border extra thick, title block thick,
  everything else thin). Each sheet is a perspective, so it's marked NTS
  (not to scale) the way a perspective viewport would be.

  Values are placeholders in Vectorworks' default style, not James's own
  paperwork.
*/

/** White as Vectorworks draws a black pen on its black background. */
export const CAD = '232, 232, 232';
/** Vectorworks' default text font, with the usual fallbacks. */
export const CAD_FONT = 'Arial, "Helvetica Neue", Helvetica, "Liberation Sans", sans-serif';

export interface SheetInfo {
  title: string;
  network: string;
  year: string;
  /** Sheet number, e.g. "LX1". */
  sheet: string;
  /** Show the title block and drawing label (the hero carries its title block in HTML). */
  titleBlock: boolean;
  /** Space kept clear at the bottom (the hero runs under the desk bar) and top (under the rig). */
  bottomInset?: () => number;
  topInset?: () => number;
  /** Draw the hazer on this sheet's deck (the hero, where the rig lives). */
  hazer?: { channel: number };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Base text size for a sheet: about 9px on a wide plate, never below 6px. */
export function sheetUnit(W: number, H: number) {
  return clamp(Math.min(W, H * 1.6) / 120, 6, 9.5);
}

/** Distance from the sheet's edge to its inner border line. */
export function sheetInset(W: number, H: number) {
  const u = sheetUnit(W, H);
  return Math.round(u * 0.8) + 0.5 + Math.round(u * 1.7);
}

/**
 * Draw the sheet's drafting into a canvas sized W by H css px (the context
 * already scaled for the pixel ratio).
 */
export function drawSheet(ctx: CanvasRenderingContext2D, W: number, fullH: number, info: SheetInfo) {
  ctx.clearRect(0, 0, W, fullH);
  const top = info.topInset?.() ?? 0;
  const H = fullH - (info.bottomInset?.() ?? 0) - top;
  if (W < 60 || H < 60) return;
  ctx.save();
  ctx.translate(0, top);
  drawSheetBody(ctx, W, H, info);
  ctx.restore();
}

function drawSheetBody(ctx: CanvasRenderingContext2D, W: number, H: number, info: SheetInfo) {
  const u = sheetUnit(W, H);
  const line = (a: number) => `rgba(${CAD}, ${a})`;
  const font = (px: number) => `${px.toFixed(1)}px ${CAD_FONT}`;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.textBaseline = 'middle';

  // Border: thin outer line, extra thick inner line, grid zones between.
  const o = Math.round(u * 0.8) + 0.5;
  const i0 = sheetInset(W, H);
  const iw = W - 2 * i0, ih = H - 2 * i0;
  ctx.strokeStyle = line(0.38);
  ctx.lineWidth = 0.6;
  ctx.strokeRect(o, o, W - 2 * o, H - 2 * o);
  ctx.strokeStyle = line(0.55);
  ctx.lineWidth = 1.6;
  ctx.strokeRect(i0, i0, iw, ih);

  const nx = Math.max(2, Math.round(iw / (u * 22)));
  const ny = Math.max(2, Math.round(ih / (u * 22)));
  ctx.strokeStyle = line(0.38);
  ctx.lineWidth = 0.6;
  ctx.fillStyle = line(0.5);
  ctx.font = font(u * 0.8);
  ctx.textAlign = 'center';
  for (let k = 0; k < nx; k++) {
    const x0 = i0 + (iw * k) / nx, x1 = i0 + (iw * (k + 1)) / nx;
    if (k > 0) {
      ctx.beginPath();
      ctx.moveTo(x0, o);
      ctx.lineTo(x0, i0);
      ctx.moveTo(x0, H - i0);
      ctx.lineTo(x0, H - o);
      ctx.stroke();
    }
    const label = String(k + 1);
    ctx.fillText(label, (x0 + x1) / 2, (o + i0) / 2);
    ctx.fillText(label, (x0 + x1) / 2, H - (o + i0) / 2);
  }
  for (let k = 0; k < ny; k++) {
    const y0 = i0 + (ih * k) / ny, y1 = i0 + (ih * (k + 1)) / ny;
    if (k > 0) {
      ctx.beginPath();
      ctx.moveTo(o, y0);
      ctx.lineTo(i0, y0);
      ctx.moveTo(W - i0, y0);
      ctx.lineTo(W - o, y0);
      ctx.stroke();
    }
    const label = String.fromCharCode(65 + (k % 26));
    ctx.fillText(label, (o + i0) / 2, (y0 + y1) / 2);
    ctx.fillText(label, W - (o + i0) / 2, (y0 + y1) / 2);
  }

  // Centre line: long dash, short dash, with the CL mark at its head.
  const cx = Math.round(W / 2) + 0.5;
  const markY = i0 + u * 2.2;
  ctx.strokeStyle = line(0.42);
  ctx.lineWidth = 0.6;
  ctx.setLineDash([u * 2.6, u * 0.55, u * 0.45, u * 0.55]);
  ctx.beginPath();
  ctx.moveTo(cx, markY + u * 1.4);
  ctx.lineTo(cx, H - i0 - u * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);
  centreMark(ctx, cx, markY, u * 1.25, line(0.6));

  if (info.hazer) drawHazer(ctx, Math.round(W * 0.42), Math.round(H - i0 - u * 2.3), u, info.hazer.channel);

  if (!info.titleBlock) return;

  // Title block, anchored bottom right inside the border.
  const tw = Math.round(clamp(W * 0.3, 132, 290));
  const compact = tw < 176;
  const rowH = u * 2.35;
  const rows = compact ? 2 : 4;
  const th = Math.round(rowH * rows + u * (compact ? 0.4 : 0.6));
  const tx = Math.round(W - i0 - tw) + 0.5;
  const ty = Math.round(H - i0 - th) + 0.5;
  ctx.fillStyle = 'rgba(3, 3, 3, 0.86)';
  ctx.fillRect(tx, ty, tw, th);
  ctx.strokeStyle = line(0.55);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(tx, ty, tw, th);

  const pad = u * 0.55;
  const label = (t: string, x: number, y: number) => {
    ctx.fillStyle = line(0.45);
    ctx.font = font(Math.max(6.5, u * 0.62));
    ctx.textAlign = 'left';
    ctx.fillText(t, x + pad, y + u * 0.62);
  };
  const value = (t: string, x: number, y: number, w: number, size = 0.92, a = 0.82) => {
    if (!t) return;
    ctx.fillStyle = line(a);
    ctx.font = font(u * size);
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, t.toUpperCase(), w - pad * 2), x + pad, y + rowH * 0.62);
  };
  const hline = (y: number, x0 = tx, x1 = tx + tw) => {
    ctx.beginPath();
    ctx.moveTo(x0, Math.round(y) + 0.5);
    ctx.lineTo(x1, Math.round(y) + 0.5);
    ctx.stroke();
  };
  const vline = (x: number, y0: number, y1: number) => {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, y0);
    ctx.lineTo(Math.round(x) + 0.5, y1);
    ctx.stroke();
  };
  ctx.strokeStyle = line(0.4);
  ctx.lineWidth = 0.5;
  // A run of years shows its last one, as a sheet's date would.
  const date = info.year.match(/\d{4}(?!.*\d{4})/)?.[0] ?? '';

  if (compact) {
    const sc = Math.round(tw * 0.3);
    value(info.title, tx, ty, tw, 0.95, 0.88);
    hline(ty + rowH);
    vline(tx + tw - sc, ty + rowH, ty + th);
    value([info.network, date, 'NTS'].filter(Boolean).join('  '), tx, ty + rowH, tw - sc, 0.8, 0.7);
    value(info.sheet, tx + tw - sc, ty + rowH, sc, 1.05, 0.9);
    return;
  }

  const rc = Math.round(tw * 0.25);
  const la = tw - rc;
  // Row 1: producing organisation. Row 2: production.
  value('Fullerton Productions', tx, ty, tw, 0.78, 0.6);
  hline(ty + rowH);
  value(info.title, tx, ty + rowH, tw, 1.05, 0.92);
  hline(ty + rowH * 2);
  // Rows 3 and 4: fields, with the sheet number to the right.
  vline(tx + la, ty + rowH * 2, ty + th);
  const r3 = ty + rowH * 2, r4 = ty + rowH * 3;
  hline(r4, tx, tx + la);
  const split = la * 0.42;
  vline(tx + split, r3, r4);
  label('DRAWING', tx, r3);
  value('Perspective', tx, r3 + u * 0.35, split, 0.8, 0.78);
  label('LIGHTING DESIGNER', tx + split, r3);
  value('James Downey', tx + split, r3 + u * 0.35, la - split, 0.8, 0.78);
  const third = la / 3;
  vline(tx + third, r4, ty + th);
  vline(tx + third * 2, r4, ty + th);
  label('CLIENT', tx, r4);
  value(info.network, tx, r4 + u * 0.35, third, 0.8, 0.78);
  label('SCALE', tx + third, r4);
  value('NTS', tx + third, r4 + u * 0.35, third, 0.8, 0.78);
  label('DATE', tx + third * 2, r4);
  value(date, tx + third * 2, r4 + u * 0.35, third, 0.8, 0.78);
  label('SHEET', tx + la, r3);
  ctx.fillStyle = line(0.92);
  ctx.font = font(u * 1.7);
  ctx.textAlign = 'center';
  ctx.fillText(fit(ctx, info.sheet, rc - pad * 2), tx + la + rc / 2, r3 + (th - rowH * 2) * 0.58);

  // Drawing label, bottom left inside the border, as Vectorworks puts under a
  // viewport: drawing number over sheet number in a split circle, the title
  // on a heavy rule, the scale under it.
  if (W >= 300) {
    const r = u * 1.35;
    const cx0 = Math.round(i0 + u * 2 + r) + 0.5;
    const cy0 = Math.round(H - i0 - u * 2.2 - r * 0.2) + 0.5;
    ctx.strokeStyle = line(0.62);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx0, cy0, r, 0, Math.PI * 2);
    ctx.moveTo(cx0 - r, cy0);
    ctx.lineTo(cx0 + r, cy0);
    ctx.stroke();
    ctx.fillStyle = line(0.85);
    ctx.textAlign = 'center';
    ctx.font = font(u * 0.82);
    ctx.fillText('1', cx0, cy0 - r * 0.45);
    ctx.font = font(u * 0.62);
    ctx.fillText(info.sheet, cx0, cy0 + r * 0.48);
    const title = 'PERSPECTIVE';
    ctx.font = font(u * 1.0);
    const tw2 = Math.max(ctx.measureText(title).width, u * 8);
    const lx = cx0 + r;
    ctx.textAlign = 'left';
    ctx.fillText(title, lx + u * 0.5, cy0 - u * 0.65);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(lx, cy0);
    ctx.lineTo(lx + u * 0.5 + tw2 + u * 0.4, cy0);
    ctx.stroke();
    ctx.fillStyle = line(0.62);
    ctx.font = font(Math.max(6.5, u * 0.72));
    ctx.fillText('SCALE: NTS', lx + u * 0.5, cy0 + u * 0.75);
  }
}

/** The centre line symbol: an L set inside a C. */
function centreMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.28, Math.PI * 1.72, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.15, y - r * 1.25);
  ctx.lineTo(x - r * 0.15, y + r * 1.05);
  ctx.lineTo(x + r * 0.9, y + r * 1.05);
  ctx.stroke();
  ctx.restore();
}

/**
 * A Spotlight label for a fixture on the rig: the channel number in a circle
 * in front of the unit (USITT). The unit number is on the fixture itself.
 */
export function drawFixtureLabel(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, channel: number, alpha = 1) {
  const r = Math.max(6.5, 8 * k);
  ctx.save();
  ctx.strokeStyle = `rgba(${CAD}, ${0.7 * alpha})`;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(${CAD}, ${0.88 * alpha})`;
  ctx.font = `${Math.max(7.5, 9.5 * k).toFixed(1)}px ${CAD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(channel), x, y + 0.5);
  ctx.restore();
}

/** A focus point as Vectorworks draws its default (Standard Hybrid) shape: an octagon with a locus, named. */
export function drawFocusPoint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, name: string, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = `rgba(${CAD}, ${0.7 * alpha})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (k) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.moveTo(x - r * 0.5, y);
  ctx.lineTo(x + r * 0.5, y);
  ctx.moveTo(x, y - r * 0.5);
  ctx.lineTo(x, y + r * 0.5);
  ctx.stroke();
  ctx.fillStyle = `rgba(${CAD}, ${0.8 * alpha})`;
  ctx.font = `${Math.max(7, r * 0.72).toFixed(1)}px ${CAD_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x + r + 3, y - r * 0.85);
  ctx.restore();
}

/** The hazer on the deck: a small box seen like the rig, its top face showing, with its nozzle and channel. */
function drawHazer(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, channel: number) {
  const w = u * 4.6, h = u * 1.6;
  const dx = u * 0.9, dy = -u * 0.65;
  const x0 = Math.round(x - w / 2) + 0.5, y0 = Math.round(y - h / 2) + 0.5;
  ctx.save();
  ctx.strokeStyle = `rgba(${CAD}, 0.62)`;
  ctx.fillStyle = 'rgb(3, 3, 3)';
  ctx.lineWidth = 0.9;
  ctx.lineJoin = 'round';
  const poly = (pts: number[][]) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  // Top, then the side, then the front, nearest last.
  poly([[x0, y0], [x0 + dx, y0 + dy], [x0 + w + dx, y0 + dy], [x0 + w, y0]]);
  poly([[x0 + w, y0], [x0 + w + dx, y0 + dy], [x0 + w + dx, y0 + h + dy], [x0 + w, y0 + h]]);
  poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]);
  // Nozzle on the front face.
  ctx.beginPath();
  ctx.arc(x0 + w * 0.82, y0 + h / 2, h * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(${CAD}, 0.7)`;
  ctx.font = `${Math.max(6.5, u * 0.68).toFixed(1)}px ${CAD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HAZER', x0 + w * 0.4, y0 + h / 2 + 0.5);
  ctx.restore();
  drawFixtureLabel(ctx, x0 - u * 1.6, y0 + h / 2, u / 9, channel);
}
