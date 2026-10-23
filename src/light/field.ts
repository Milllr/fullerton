import { CELL, type Warmth } from './warmth';

/*
  The page itself, drawn by one full screen shader behind everything:

  - Paper: warm cream, with the soft fields of colour of a 2000s gradient
    (amber, a grey teal, a little burnt brown) drifting very slowly and
    shifting as the page scrolls.
  - Warmth: wherever the pointer has been, the paper takes on the colour of
    a tungsten lamp, pale where it's hot and deepening to amber as it cools.
  - On the cover, a window gobo: late light through a window, thrown across
    the paper the way an LD throws a window gobo onto a set. The glazing
    bars go soft further from the window, leaves drift through it, and the
    pointer (or a finger) casts a soft shadow where it passes through the
    light.
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

  // The window gobo: light through the panes, soft glazing bars, leaves, the pointer's shadow.
  if (uGobo > .001) {
    vec2 st = invBilinear(px, uQ0, uQ1, uQ2, uQ3);
    float soft = .014 + .07 * clamp(st.y, 0., 1.);
    float inside = smoothstep(0., soft, st.x) * smoothstep(1., 1. - soft, st.x) * smoothstep(0., soft, st.y) * smoothstep(1., 1. - soft, st.y);
    float bw = .011;
    float bs = soft * .9 + .004;
    float bar = 1. - smoothstep(bw, bw + bs, abs(st.x - .5));
    bar = max(bar, 1. - smoothstep(bw, bw + bs, abs(st.y - .34)));
    bar = max(bar, 1. - smoothstep(bw, bw + bs, abs(st.y - .67)));
    float light = inside * (1. - bar * .88);
    float leaf = fbm(st * vec2(2.6, 3.4) + vec2(uTime * .021, -uTime * .013));
    light *= mix(.5, 1., smoothstep(.38, .62, leaf));
    vec2 hp = px - uHand.xy - vec2(16., 22.);
    float hand = 1. - smoothstep(.25, 1., length(hp * vec2(1., .82)) / 74.);
    light *= 1. - hand * uHand.z * .72;
    float g = light * uGobo;
    c *= 1. - .035 * uGobo;
    c = mix(c, min(vec3(1.), c * 1.05 + vec3(1., .91, .76) * .1), g * .85);
    // The edges of the light run a little warmer, as real light through glass does.
    float fringe = inside * (1. - inside) * 4.;
    c += vec3(.045, .018, -.02) * fringe * uGobo;
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

/** The window gobo: its four corners on screen (x, y pairs, top left round to bottom left), how strong, and the pointer's shadow (x, y, how present). */
export interface Gobo {
  q: number[];
  strength: number;
  hand: [number, number, number];
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
      for (const n of ['uRes', 'uScale', 'uTime', 'uScroll', 'uHeat', 'uGrid', 'uShift', 'uSeed', 'uGrain', 'uQ0', 'uQ1', 'uQ2', 'uQ3', 'uGobo', 'uHand'])
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
    const key = `${this.w}x${this.h}|${time.toFixed(1)}|${scroll.toFixed(0)}|${seed}|${warmth.shift.toFixed(1)}|${gobo.strength.toFixed(3)}|${gobo.hand.map((v) => v.toFixed(1)).join()}|${gobo.q.map((v) => v.toFixed(1)).join()}`;
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
