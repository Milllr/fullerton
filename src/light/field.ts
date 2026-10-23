import { CELL, type Warmth } from './warmth';

/*
  The page itself, drawn by one full screen shader behind everything:

  - Paper: warm cream, with the soft fields of colour of a 2000s gradient
    (amber, a grey teal, a little burnt brown) drifting very slowly and
    shifting as the page scrolls.
  - Warmth: wherever the pointer has been, the paper takes on the colour of
    a tungsten lamp, pale where it's hot and deepening to amber as it cools.
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
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
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
      for (const n of ['uRes', 'uScale', 'uTime', 'uScroll', 'uHeat', 'uGrid', 'uShift', 'uSeed', 'uGrain']) this.u[n] = gl.getUniformLocation(prog, n);
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

  draw(time: number, scroll: number, seed: number, warmth: Warmth) {
    const gl = this.gl;
    if (!gl || !this.prog || !this.ok) return;
    if (!this.w) this.resize();
    const key = `${this.w}x${this.h}|${time.toFixed(1)}|${scroll.toFixed(0)}|${seed}|${warmth.shift.toFixed(1)}`;
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
