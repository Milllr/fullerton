import type { Pool } from './rig';

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/*
  Everything the rig does outside the photographs, the way it would on a
  black stage, for up to four fixtures (two spots, two soft panels):
  - each beam through haze, with a little scatter glowing around it,
  - each spot's pool on the floor, shaped by its real gobo mask,
  - the panels' broad, even fields,
  - flare and spill that fade out across the stage well past each pool,
  - colour bounced back off whatever set the spots are landing on,
  - the glow at each fixture's lens or diffuser.
*/
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uScale;
uniform float uHaze;
uniform float uTime;
uniform vec3 uBounce;
uniform float uBounceAmt;
uniform vec2 uBouncePos;
uniform vec2 uBounceAxes;

uniform vec2 uLens[4];
uniform float uLensW[4];
uniform vec2 uPool[4];
uniform vec2 uAxes[4];
uniform float uAngle[4];
uniform vec3 uColor[4];
uniform float uI[4];
uniform float uPoolI[4];
uniform float uSoft[4];
uniform float uKind[4];
uniform float uGobo[4];
uniform float uSpin[4];
uniform sampler2D uGoboTex0;
uniform sampler2D uGoboTex1;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uScale - gl_FragCoord.y) / uScale;
  vec2 hp = p * 0.0032 + vec2(uTime * 0.011, -uTime * 0.017);
  float haze = smoothstep(0.2, 0.9, fbm(hp)) * 1.7;

  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (uI[i] < 0.002) continue;
    bool panel = uKind[i] > 0.5;

    vec2 ax = uPool[i] - uLens[i];
    float len = max(length(ax), 1.0);
    vec2 u = ax / len;
    vec2 n = vec2(-u.y, u.x);
    vec2 q = p - uLens[i];
    float t = dot(q, u) / len;
    float d = dot(q, n);

    vec2 ea = vec2(cos(uAngle[i]), sin(uAngle[i]));
    vec2 eb = vec2(-ea.y, ea.x);
    float wa = uAxes[i].x * dot(ea, n);
    float wb = uAxes[i].y * dot(eb, n);
    float wP = sqrt(wa * wa + wb * wb);
    float w = mix(uLensW[i], wP, clamp(t, 0.0, 1.0));
    float s = d / w;

    float edge = 1.0 - smoothstep(1.0 - uSoft[i], 1.0, abs(s));
    float scatter = 1.0 - smoothstep(0.6, 2.6, abs(s));
    float along = smoothstep(0.0, 0.03, t) * (1.0 - smoothstep(0.96, 1.06, t));

    float g = 1.0;
    float gb = uGobo[i];
    if (gb > 0.5 && gb < 1.5) g = 0.45 + 0.55 * smoothstep(0.35, 0.7, fbm(vec2(s * 2.6 + uSpin[i] * 0.5, t * 0.7 + 3.0 + float(i))));
    else if (gb > 1.5 && gb < 2.5) g = 0.4 + 0.6 * smoothstep(0.15, 0.85, 0.5 + 0.5 * cos(s * 15.0 + uSpin[i] * 2.0));
    else if (gb > 2.5) g = 0.25 + 0.75 * smoothstep(0.45, 0.9, abs(s));

    float fall = mix(1.5, 0.5, clamp(t, 0.0, 1.0));
    // Panels throw a wide, faint, even column; spots a tight bright shaft.
    float shaftK = panel ? 0.05 : 0.3;
    float shaft = (edge * g + scatter * 0.22) * along * haze * fall * uHaze * shaftK;

    vec2 pr = p - uPool[i];
    vec2 pe = vec2(dot(pr, ea) / uAxes[i].x, dot(pr, eb) / uAxes[i].y);
    float e2 = dot(pe, pe);
    float floorL;
    if (panel) {
      // Even field, soft towards the edge; the panel's light on bare stage is faint.
      float f1 = max(1.0 - e2, 0.0);
      float f = f1 * sqrt(f1);
      floorL = f * 0.024 + exp(-e2 * 0.6) * 0.006;
    } else {
      float cs = cos(uSpin[i]), sn = sin(uSpin[i]);
      vec2 gq = vec2(cs * pe.x + sn * pe.y, -sn * pe.x + cs * pe.y);
      vec2 uv = gq * 0.5 + 0.5;
      float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      float m0 = texture2D(uGoboTex0, uv).a;
      float m1 = texture2D(uGoboTex1, uv).a;
      float mask = (i == 0 ? m0 : m1) * inside;
      floorL = mask * 0.11 + exp(-e2 * 0.6) * 0.07 + exp(-e2 * 0.14) * 0.03 + exp(-e2 * 0.035) * 0.012;
    }

    float r = length(p - uLens[i]);
    float glowR = panel ? max(1.0, uLensW[i]) : 9.0;
    float lens = exp(-r * (1.0 / glowR)) * (panel ? 0.35 : 1.1) + exp(-r * 0.025) * (panel ? 0.05 : 0.12);

    acc += uColor[i] * ((shaft + lens * 0.7) + floorL * uPoolI[i]) * uI[i];
  }

  vec2 bp = (p - uBouncePos) / max(uBounceAxes, vec2(1.0));
  acc += uBounce * exp(-dot(bp, bp) * 0.09) * uBounceAmt;

  vec3 c = acc + (hash(p + uTime) - 0.5) / 255.0;
  c = max(c, 0.0);
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  gl_FragColor = vec4(c, a);
}
`;

export interface Beam {
  kind: 'spot' | 'panel';
  lens: { x: number; y: number };
  lensW: number;
  pool: Pool;
  colour: [number, number, number];
  /** Fixture output 0..1. */
  I: number;
  /** Extra factor on the pool for throw distance. */
  poolI: number;
  soft: number;
  gobo: number;
  spin: number;
}

export interface ShaftFrame {
  vw: number;
  vh: number;
  haze: number;
  time: number;
  beams: Beam[];
  bounce: [number, number, number];
  bounceAmt: number;
  bouncePos: { x: number; y: number };
  bounceAxes: { x: number; y: number };
}

export class Shaft {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private scale = 0.5;
  private tex: (WebGLTexture | null)[] = [null, null];
  private texSource: (HTMLCanvasElement | null)[] = [null, null];
  ok = true;

  /** True while the GPU has taken the context away (iOS does this to background tabs). */
  private lost = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.ok = this.init();
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.texSource = [null, null];
      this.lost = !this.init();
      if (!this.lost) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    });
  }

  /** Compile, upload and bind everything. Runs again after a lost context comes back. */
  private init() {
    const gl = this.gl;
    const prog = this.program();
    if (!prog) return false;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const name of [
      'uRes', 'uScale', 'uHaze', 'uTime', 'uBounce', 'uBounceAmt', 'uBouncePos', 'uBounceAxes',
      'uLens', 'uLensW', 'uPool', 'uAxes', 'uAngle', 'uColor', 'uI', 'uPoolI', 'uSoft', 'uKind', 'uGobo', 'uSpin',
      'uGoboTex0', 'uGoboTex1',
    ]) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      this.tex[i] = t;
    }
    gl.uniform1i(this.u.uGoboTex0, 0);
    gl.uniform1i(this.u.uGoboTex1, 1);
    return true;
  }

  static create(canvas: HTMLCanvasElement): Shaft | null {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const s = new Shaft(canvas, gl);
    return s.ok ? s : null;
  }

  private program() {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const v = sh(gl.VERTEX_SHADER, VERT), f = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!v || !f) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }

  /** The gobo mask each spot reveals the photos through, so its floor pool matches. */
  setGobo(spot: 0 | 1, mask: HTMLCanvasElement) {
    if (this.lost || mask === this.texSource[spot]) return;
    this.texSource[spot] = mask;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + spot);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[spot]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
  }

  /** Upper limit on render scale; tests lower it to run quickly in software. */
  maxScale = 1;

  resize(vw: number, vh: number, lowPower: boolean) {
    // Haze is soft: it never needs more than three quarters of a CSS pixel per
    // pixel, and that 5 octave noise runs for every one of them every frame.
    this.scale = Math.min(this.maxScale, 0.75, (devicePixelRatio || 1) * (lowPower ? 0.35 : 0.5));
    this.canvas.width = Math.max(1, Math.round(vw * this.scale));
    this.canvas.height = Math.max(1, Math.round(vh * this.scale));
    if (!this.lost) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(o: ShaftFrame) {
    if (this.lost) return;
    const gl = this.gl, u = this.u;
    gl.uniform2f(u.uRes, o.vw, o.vh);
    gl.uniform1f(u.uScale, this.scale);
    gl.uniform1f(u.uHaze, o.haze);
    gl.uniform1f(u.uTime, o.time);
    gl.uniform3f(u.uBounce, o.bounce[0], o.bounce[1], o.bounce[2]);
    gl.uniform1f(u.uBounceAmt, o.bounceAmt);
    gl.uniform2f(u.uBouncePos, o.bouncePos.x, o.bouncePos.y);
    gl.uniform2f(u.uBounceAxes, o.bounceAxes.x, o.bounceAxes.y);
    const N = 4;
    const f2 = (fn: (b: Beam) => [number, number]) => new Float32Array(Array.from({ length: N }, (_, i) => (o.beams[i] ? fn(o.beams[i]) : [0, 0])).flat());
    const f1 = (fn: (b: Beam) => number) => new Float32Array(Array.from({ length: N }, (_, i) => (o.beams[i] ? fn(o.beams[i]) : 0)));
    gl.uniform2fv(u.uLens, f2((b) => [b.lens.x, b.lens.y]));
    gl.uniform1fv(u.uLensW, f1((b) => Math.max(1, b.lensW)));
    gl.uniform2fv(u.uPool, f2((b) => [b.pool.x, b.pool.y]));
    gl.uniform2fv(u.uAxes, f2((b) => [Math.max(1, b.pool.rx), Math.max(1, b.pool.ry)]));
    gl.uniform1fv(u.uAngle, f1((b) => b.pool.angle));
    gl.uniform3fv(u.uColor, new Float32Array(Array.from({ length: N }, (_, i) => (o.beams[i] ? o.beams[i].colour : [0, 0, 0])).flat()));
    gl.uniform1fv(u.uI, f1((b) => b.I));
    gl.uniform1fv(u.uPoolI, f1((b) => b.poolI));
    gl.uniform1fv(u.uSoft, f1((b) => b.soft));
    gl.uniform1fv(u.uKind, f1((b) => (b.kind === 'panel' ? 1 : 0)));
    gl.uniform1fv(u.uGobo, f1((b) => b.gobo));
    gl.uniform1fv(u.uSpin, f1((b) => b.spin));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
