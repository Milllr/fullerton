import { CELL, type Warmth } from './warmth';

/*
  The page itself, drawn by one full screen shader behind everything:

  - Paper: warm cream, with the soft fields of colour of a 2000s gradient
    (amber, a grey teal, a little burnt brown) drifting very slowly and
    shifting as the page scrolls.
  - Warmth: wherever the pointer has been, the paper takes on the colour of
    a tungsten lamp, pale where it's hot and deepening to amber as it cools.
  - On the cover, a gobo: a profile spot off to the upper right throws it
    across the paper, so the round beam lands keystoned, sharpest across
    its near third and softer further away, with the faint colour fringes
    of a real lens at its edges. Its wheel holds four steel gobos and
    turns to the next every so often (src/light/gobo.ts); the breakup
    turns slowly on its own. The pointer (or a finger) casts a soft
    shadow where it passes through the light.
  - Film grain over all of it.
*/

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uScale;
uniform float uTime;
uniform float uScroll;
uniform sampler2D uHeat;
uniform vec2 uGrid;
uniform float uShift;
uniform float uSeed;
uniform float uGrain;
uniform vec2 uQ0;
uniform vec2 uQ1;
uniform vec2 uQ2;
uniform vec2 uQ3;
uniform float uGobo;
uniform vec3 uHand;
uniform float uWheel;
uniform float uFocus;
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3. - 2. * f);
  float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  return .55 * vnoise(p) + .3 * vnoise(p * 2.1 + 3.7) + .15 * vnoise(p * 4.3 - 1.9);
}

float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

// Where a point falls in the window's light: (0,0) top left of the patch, (1,1) bottom right (after Inigo Quilez).
vec2 invBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  vec2 e = b - a, f = d - a, g = a - b + c - d, h = p - a;
  float k2 = cross2(g, f);
  float k1 = cross2(e, f) + cross2(h, g);
  float k0 = cross2(h, e);
  if (abs(k2) < 1e-3) {
    float v = -k0 / k1;
    return vec2((h.x - f.x * v) / (e.x + g.x * v), v);
  }
  float w = k1 * k1 - 4. * k0 * k2;
  if (w < 0.) return vec2(-1.);
  w = sqrt(w);
  float v = (-k1 - w) / (2. * k2);
  float u = (h.x - f.x * v) / (e.x + g.x * v);
  if (u < 0. || u > 1. || v < 0. || v > 1.) {
    v = (-k1 + w) / (2. * k2);
    u = (h.x - f.x * v) / (e.x + g.x * v);
  }
  return vec2(u, v);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

// A leaf, pointed at both ends: half length l, half width w, < 0 inside (a vesica, after Inigo Quilez).
float leaf(vec2 p, float l, float w) {
  float r = (l * l / w + w) * .5, d = r - w;
  p = abs(p.yx);
  return (p.y - l) * d > p.x * l ? length(p - vec2(0., l)) : length(p + vec2(d, 0.)) - r;
}

// A breakup of leaves, two layers of them scattered at every angle: > 0 between them, where the light gets through.
// Leaves further than the blur b can reach are passed over.
float leaves(vec2 p, float b) {
  float d = 1e3;
  for (float layer = 0.; layer < 2.; layer++) {
    float s = layer < .5 ? .3 : .22;
    vec2 q = p / s + layer * 7.3;
    vec2 i = floor(q);
    float reach = .85 + b / s;
    for (float y = -1.; y <= 1.; y++)
      for (float x = -1.; x <= 1.; x++) {
        vec2 c = i + vec2(x, y) + layer * 31.;
        float h = hash(c), h2 = hash(c * 1.7 + 3.1);
        vec2 v = q - (i + vec2(x, y) + .5 + (vec2(h, h2) - .5) * .8);
        if (dot(v, v) > reach * reach) continue;
        d = min(d, leaf(rot(h * 18.85) * v, .55 + .3 * h2, .17 + .07 * h) * s);
      }
  }
  return d;
}

// The steel of each gobo, in its own coordinates (the gate's radius is 1): how far a point is inside a cut, so > 0 lets the light through.
float cut(float k, vec2 p, float b) {
  if (k < .5) {
    // A window of six panes.
    return min(abs(p.x), min(abs(p.y - .34), abs(p.y + .34))) - .022;
  }
  if (k < 1.5) return leaves(rot(uTime * .02) * p, b);
  if (k < 2.5) {
    // Venetian blinds, the slats a little tilted, with their two ladder cords.
    vec2 q = rot(-.05) * p;
    float gaps = .03 - abs(fract(q.y / .14) - .5) * .14;
    return min(gaps, abs(abs(q.x) - .46) - .006);
  }
  // Leaded lights: diamond panes.
  vec2 e = .5 - abs(fract(vec2(p.x / .36 + p.y / .52, p.y / .52 - p.x / .36)) - .5);
  return min(e.x, e.y) * .296 - .012;
}

// How much light gets through the gate at p, focus blur b: the round gate, and the slots of the wheel either side of it.
#define SLOTS 8.
#define WHEEL 3.1
#define HOLE 1.12
float gate(vec2 p, float b) {
  float edge = 1. - length(p);
  if (edge < -b) return 0.;
  float open = 0.;
  float k = floor(uWheel);
  for (float i = 0.; i < 2.; i++) {
    float a = (k + i - uWheel) * 6.2832 / SLOTS;
    vec2 q = rot(-a) * (p - vec2(0., WHEEL)) + vec2(0., WHEEL);
    if (length(q) > HOLE + b) continue;
    open += smoothstep(-b, b, min(HOLE - length(q), cut(mod(k + i, 4.), q, b)));
  }
  return smoothstep(-b, b, edge) * min(open, 1.);
}

float field(vec2 px, vec2 c, float r) {
  float d = length(px - c) / r;
  return exp(-d * d * 1.6);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 view = uRes / uScale;
  float m = max(view.x, view.y);
  float t = uTime * .018;
  float s = uScroll / view.y;

  vec3 c = vec3(.952, .94, .91);
  vec2 warmC = view * vec2(.8 + .07 * sin(t + s * .55), .16 + .1 * cos(t * .8 + s * .42));
  vec2 coolC = view * vec2(.1 + .06 * cos(t * .6 + s * .38), .88 + .07 * sin(t * .9 + s * .5));
  vec2 duskC = view * vec2(.62 + .12 * sin(t * .5 + s * .3 + 2.), 1.12 + .08 * cos(t * .7 + s * .44));
  c = mix(c, vec3(.94, .82, .67), field(px, warmC, .62 * m) * .5);
  c = mix(c, vec3(.77, .81, .815), field(px, coolC, .6 * m) * .42);
  c = mix(c, vec3(.62, .52, .44), field(px, duskC, .42 * m) * .16);

  // The gobo: the beam through the gate, a little hotter in the middle and on the near side, and the pointer's shadow.
  if (uGobo > .001) {
    vec2 st = invBilinear(px, uQ0, uQ1, uQ2, uQ3);
    vec2 p = (st * 2. - 1.) * 1.04;
    float b = (.009 + .03 * abs(st.y - .3)) * (1. + uFocus * 3.5);
    float l = gate(p, b);
    // The lens throws red a touch wider than blue, more so towards the edge of the beam: each is the light a little
    // further in or out along the radius, from its slope (p as screen steps, so the slope comes from the derivatives).
    vec2 dx = dFdx(p), dy = dFdy(p);
    float det = dx.x * dy.y - dx.y * dy.x;
    vec2 sp = abs(det) > 1e-9 ? vec2(p.x * dy.y - p.y * dy.x, dx.x * p.y - dx.y * p.x) / det : vec2(0.);
    float along = .008 * dot(p, p) * (dFdx(l) * sp.x + dFdy(l) * sp.y);
    vec3 lit = clamp(vec3(l - along, l, l + along), 0., 1.);
    float hot = mix(.84, 1., 1. - dot(p, p)) * (1.05 - .1 * st.y);
    vec2 hp = px - uHand.xy - vec2(16., 22.);
    float hand = 1. - smoothstep(.25, 1., length(hp * vec2(1., .82)) / 74.);
    vec3 g = lit * hot * (1. - hand * uHand.z * .72) * uGobo;
    c *= 1. - .035 * uGobo;
    c = mix(c, min(vec3(1.), c * 1.05 + vec3(1., .91, .76) * .1), g * .74);
    // The edges of the light run a little warmer, as real light does.
    c += vec3(.03, .012, -.014) * lit.g * (1. - lit.g) * 4. * uGobo;
  }

  vec2 huv = vec2(px.x / ${CELL}. + 1., (px.y - uShift) / ${CELL}. + 1.) / uGrid;
  float h = texture(uHeat, huv).r;
  h = h * h * (3. - 2. * h);
  // Hot is a pale warm white; cooling, it deepens to amber.
  vec3 hot = vec3(1., .9, .74);
  vec3 cool = vec3(.97, .66, .4);
  vec3 lamp = mix(cool, hot, smoothstep(.35, .95, h));
  c = mix(c, c * lamp, h * .62);
  c = mix(c, lamp, smoothstep(.5, 1., h) * .22);

  float n = hash(gl_FragCoord.xy + uSeed * 61.7) + hash(gl_FragCoord.xy * 1.37 - uSeed * 17.3) - 1.;
  float lum = dot(c, vec3(.2126, .7152, .0722));
  c += n * uGrain * (.5 + 2. * lum * (1. - lum));
  outColor = vec4(c, 1.);
}`;

/** The gobo: the four corners of its gate on screen (x, y pairs, top left round to bottom left), how strong, the pointer's shadow (x, y, how present), where its wheel is (in slots) and how soft its focus (0 to 1). */
export interface Gobo {
  q: number[];
  strength: number;
  hand: [number, number, number];
  wheel: number;
  focus: number;
}

export class Field {
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private scale = 1;
  private w = 0;
  private h = 0;
  private texSize = '';
  private lastKey = '';
  /** False when there's no WebGL; the page falls back to a CSS gradient. */
  ok = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private grain = 0.032,
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
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
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
      for (const n of ['uRes', 'uScale', 'uTime', 'uScroll', 'uHeat', 'uGrid', 'uShift', 'uSeed', 'uGrain', 'uQ0', 'uQ1', 'uQ2', 'uQ3', 'uGobo', 'uHand', 'uWheel', 'uFocus'])
        this.u[n] = gl.getUniformLocation(prog, n);
      this.tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.uniform1i(this.u.uHeat, 0);
      this.gl = gl;
      this.prog = prog;
      this.ok = true;
      this.w = this.h = 0;
      this.texSize = '';
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

  draw(time: number, scroll: number, seed: number, warmth: Warmth, gobo: Gobo) {
    const gl = this.gl;
    if (!gl || !this.prog || !this.ok) return;
    if (!this.w) this.resize();
    const key = `${this.w}x${this.h}|${time.toFixed(1)}|${scroll.toFixed(0)}|${seed}|${warmth.shift.toFixed(1)}|${gobo.strength.toFixed(3)}|${gobo.hand.map((v) => v.toFixed(1)).join()}|${gobo.q.map((v) => v.toFixed(1)).join()}|${gobo.wheel.toFixed(4)}|${gobo.focus.toFixed(3)}`;
    if (key === this.lastKey && !warmth.dirty) return;
    this.lastKey = key;
    if (warmth.dirty && warmth.cols) {
      const size = `${warmth.cols}x${warmth.rows}`;
      if (size !== this.texSize) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, warmth.cols, warmth.rows, 0, gl.RED, gl.UNSIGNED_BYTE, warmth.bytes);
        this.texSize = size;
      } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, warmth.cols, warmth.rows, gl.RED, gl.UNSIGNED_BYTE, warmth.bytes);
      warmth.dirty = false;
    }
    gl.viewport(0, 0, this.w, this.h);
    gl.uniform2f(this.u.uRes, this.w, this.h);
    gl.uniform1f(this.u.uScale, this.scale);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uScroll, scroll);
    gl.uniform2f(this.u.uGrid, warmth.cols || 1, warmth.rows || 1);
    gl.uniform1f(this.u.uShift, warmth.shift);
    gl.uniform1f(this.u.uSeed, seed % 97);
    gl.uniform1f(this.u.uGrain, this.grain);
    const q = gobo.q;
    gl.uniform2f(this.u.uQ0, q[0], q[1]);
    gl.uniform2f(this.u.uQ1, q[2], q[3]);
    gl.uniform2f(this.u.uQ2, q[4], q[5]);
    gl.uniform2f(this.u.uQ3, q[6], q[7]);
    gl.uniform1f(this.u.uGobo, gobo.strength);
    gl.uniform3f(this.u.uHand, gobo.hand[0], gobo.hand[1], gobo.hand[2]);
    gl.uniform1f(this.u.uWheel, gobo.wheel);
    gl.uniform1f(this.u.uFocus, gobo.focus);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
