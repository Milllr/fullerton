/*
  The page itself: a sheet of warm paper lit by the one lamp, drawn by a
  single full screen shader behind everything.

  - The lamp's light falls on the paper as a point source above it: inverse
    square with the cosine, so the pool is hot under the lamp and falls away
    smoothly. A flown out lamp (higher) gives a wider, softer, dimmer pool.
  - Daylight from off the page, cool and falling away to the corners, is
    what's left when the lamp is out.
  - The filament, out of focus, glows as a hot core and a wide halo.
  - Isolux contours, the photometric plot of the same light, drawn as thin
    rings and labelled in lux like the contours on a map. They close in as
    the lamp dims, and vanish when it goes out.
  - Film grain over all of it.
*/

export interface FieldState {
  /** The filament, CSS px from the top left of the viewport. */
  x: number;
  y: number;
  /** Height of the lamp above the paper, CSS px: sets the photometric falloff the contours follow. */
  h: number;
  /** Radius the colour of the light spreads to, CSS px; and how strong it is, 0..1. */
  spread: number;
  warmth: number;
  /** Brightness as the eye takes it, 0..1. */
  bright: number;
  /** Illuminance right under the lamp, lux. */
  lux: number;
  /** Glow of the filament itself, 0..1. */
  glow: number;
  /** Lamp colour, sRGB 0..1. */
  rgb: [number, number, number];
  /** How strongly the contours are drawn, 0..1. */
  contour: number;
  /** Where the contour labels sit, so the rings break around them: x, y, radius in CSS px. */
  knock: [number, number, number][];
  /** Grain frame. */
  seed: number;
}

/** The lux of each ring, decade rings drawn heavier as on a map. */
export const LEVELS = [1000, 500, 200, 100, 50, 20, 10];
const KNOCKS = 8;

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uScale;
uniform vec2 uLamp;
uniform float uH;
uniform float uR;
uniform float uWarm;
uniform float uBright;
uniform float uLux;
uniform float uGlow;
uniform vec3 uTint;
uniform vec3 uWhite;
uniform float uSeed;
uniform float uGrain;
uniform float uContour;
uniform vec3 uKnock[${KNOCKS}];
out vec4 outColor;

const float LEVELS[${LEVELS.length}] = float[${LEVELS.length}](${LEVELS.map((l) => l.toFixed(1)).join(', ')});

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.), vec3(1. / 2.2)); }
// Linear up to the shoulder, then rolls off: the hot centre goes to a warm white rather than clipping.
float shoulder(float x) { return x < .86 ? x : .86 + .14 * (1. - exp(-(x - .86) / .14)); }

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 view = uRes / uScale;
  vec2 d = px - uLamp;
  float r2 = dot(d, d);
  float h2 = uH * uH;
  float shape = pow(h2 / (r2 + h2), 1.5);
  float far = length(d) / max(view.x, view.y);

  // The room: warm paper while the lamp is up, a cool blue hour grey when it's out.
  float room = .22 + .78 * pow(uBright, .7);
  vec3 c = mix(vec3(.705, .73, .75), vec3(.958, .944, .914), room);
  c = mix(c, c * vec3(.9, .935, .99), smoothstep(.3, 1.2, far) * (1. - .4 * uBright));
  // The lamp's colour soaks into the paper around it, richer as it dims.
  float stain = exp(-pow(sqrt(r2) / (uR * 1.3), 1.45)) * pow(uBright, .45) * uWarm;
  c *= mix(vec3(1.), uTint, stain * .66);
  // The pool itself, lifting the paper towards a warm white right under the lamp.
  float pool = pow(pow(uR * uR / (r2 + uR * uR), 1.5), 2.2) * uBright * uBright * mix(.55, 1., uWarm);
  c = mix(c, uWhite, pool * .92);
  // The filament seen out of focus: a hot core and a halo.
  float r = sqrt(r2);
  vec3 g = toLin(uWhite) * uGlow * (1.4 * exp(-r / 8.) + .45 * exp(-r / 34.)) + toLin(uTint) * uGlow * .22 * exp(-r / 110.);
  vec3 s = toSrgb(toLin(c) + g);
  s = vec3(shoulder(s.r), shoulder(s.g), shoulder(s.b));

  float lux = uLux * shape;
  float fw = max(fwidth(lux), 1e-5);
  float line = 0.;
  for (int i = 0; i < ${LEVELS.length}; i++) {
    float L = LEVELS[i];
    float a = 1. - smoothstep(.35 * uScale, .35 * uScale + 1., abs(lux - L) / fw);
    a *= smoothstep(.97, .82, L / max(uLux, 1e-3));
    float decade = (i == 0 || i == 3 || i == 6) ? 1. : .6;
    line = max(line, a * decade);
  }
  for (int k = 0; k < ${KNOCKS}; k++) {
    vec3 kn = uKnock[k];
    if (kn.z > 0.) line *= smoothstep(kn.z, kn.z + 2., length(px - kn.xy));
  }
  s = mix(s, vec3(.16, .13, .1), line * uContour * .2);

  float n = hash(gl_FragCoord.xy + uSeed * 61.7) + hash(gl_FragCoord.xy * 1.37 - uSeed * 17.3) - 1.;
  float lum = dot(s, vec3(.2126, .7152, .0722));
  s += n * uGrain * (.5 + 2. * lum * (1. - lum));
  outColor = vec4(s, 1.);
}`;

export class Field {
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private scale = 1;
  private w = 0;
  private h = 0;
  private lastKey = '';
  /** False when there's no WebGL; the page falls back to a CSS gradient. */
  ok = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private grain = 0.034,
  ) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ok = false;
      this.prog = null;
    });
    canvas.addEventListener('webglcontextrestored', () => this.init());
    this.init();
  }

  private init() {
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.bindAttribLocation(prog, 0, 'p');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uRes', 'uScale', 'uLamp', 'uH', 'uR', 'uWarm', 'uBright', 'uLux', 'uGlow', 'uTint', 'uWhite', 'uSeed', 'uGrain', 'uContour', 'uKnock'])
        this.u[n] = gl.getUniformLocation(prog, n);
      this.gl = gl;
      this.prog = prog;
      this.ok = true;
      this.w = this.h = 0;
      this.lastKey = '';
    } catch (err) {
      console.warn('Field: no WebGL', err);
      this.ok = false;
    }
  }

  /**
   * Match the drawing buffer to the canvas. The canvas is sized to the large
   * viewport (100lvh), so a phone's address bar showing or hiding doesn't
   * change it.
   */
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (w === this.w && h === this.h && dpr === this.scale) return;
    this.scale = dpr;
    this.canvas.width = this.w = w;
    this.canvas.height = this.h = h;
    this.lastKey = '';
  }

  draw(s: FieldState) {
    const gl = this.gl;
    if (!gl || !this.prog || !this.ok) return;
    if (!this.w) this.resize();
    const key = [s.x.toFixed(1), s.y.toFixed(1), s.h.toFixed(1), s.spread.toFixed(1), s.warmth.toFixed(3), s.bright.toFixed(4), s.lux.toFixed(2), s.glow.toFixed(4), s.rgb.map((v) => v.toFixed(3)).join(), s.contour.toFixed(3), s.seed, s.knock.map((k) => k.map((v) => v.toFixed(0)).join()).join(';')].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    gl.viewport(0, 0, this.w, this.h);
    gl.uniform2f(this.u.uRes, this.w, this.h);
    gl.uniform1f(this.u.uScale, this.scale);
    gl.uniform2f(this.u.uLamp, s.x, s.y);
    gl.uniform1f(this.u.uH, s.h);
    gl.uniform1f(this.u.uR, s.spread);
    gl.uniform1f(this.u.uWarm, s.warmth);
    gl.uniform1f(this.u.uBright, s.bright);
    gl.uniform1f(this.u.uLux, s.lux);
    gl.uniform1f(this.u.uGlow, s.glow);
    // The stain is the lamp's colour pushed richer; the pool is the same colour washed towards white.
    const [r, g, b] = s.rgb;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    const sat = (v: number) => Math.min(1, Math.max(0, l + (v - l) * 1.3));
    // Low down the stain goes to a burnt brown rather than pink.
    const dark = 0.7 + 0.3 * Math.min(1, s.bright * 1.6);
    gl.uniform3f(this.u.uTint, sat(r) * (0.96 + 0.04 * dark), sat(g * 0.9) * dark, sat(b * 0.72) * dark);
    gl.uniform3f(this.u.uWhite, 1, 0.9 + 0.1 * g, 0.78 + 0.22 * b);
    gl.uniform1f(this.u.uSeed, s.seed % 97);
    gl.uniform1f(this.u.uGrain, this.grain);
    gl.uniform1f(this.u.uContour, s.contour);
    const k = new Float32Array(KNOCKS * 3);
    s.knock.slice(0, KNOCKS).forEach((v, i) => k.set(v, i * 3));
    gl.uniform3fv(this.u.uKnock, k);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
