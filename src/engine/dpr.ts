/*
  Pixel density for the canvases. Above about 1.5 the hairlines and the lit
  photos look no different, but every canvas costs the square of it in GPU
  memory and fill: a 1.75x laptop drew the hero alone at 5.5 megapixels per
  layer. Capping here keeps laptops and phones smooth.
*/
export const CANVAS_DPR_MAX = 1.5;

export const canvasDpr = () => Math.min(CANVAS_DPR_MAX, devicePixelRatio || 1);
