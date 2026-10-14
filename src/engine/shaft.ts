import type { Pool } from './rig';

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/*
  Everything the light does outside the photographs, the way it would on a
  black stage:
  - the shaft through haze, with a little scatter glowing around it,
  - the pool on the floor, shaped by the real gobo mask,
  - flare and spill that fade out across the stage well past the pool,
  - colour bounced back off whatever set the pool is landing on,
  - the lens glow at the fixture.
*/
const FRAG = `
precision highp float;
uniform vec2 uRes;      // css px
uniform float uScale;   // backing px per css px
uniform vec2 uLens;
uniform vec2 uPool;
uniform vec2 uAxes;
uniform float uAngle;
uniform vec3 uColor;
uniform float uDim;
uniform float uPoolI;   // pool intensity after throw distance
uniform float uHaze;
uniform float uTime;
uniform float uGobo;
uniform float uSpin;
uniform float uSoft;
uniform vec3 uBounce;
uniform float uBounceAmt;
uniform sampler2D uGoboTex;

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

  /* The shaft. */
  vec2 ax = uPool - uLens;
  float len = max(length(ax), 1.0);
  vec2 u = ax / len;
  vec2 n = vec2(-u.y, u.x);
  vec2 q = p - uLens;
  float t = dot(q, u) / len;
  float d = dot(q, n);

  vec2 ea = vec2(cos(uAngle), sin(uAngle));
  vec2 eb = vec2(-ea.y, ea.x);
  float wP = sqrt(pow(uAxes.x * dot(ea, n), 2.0) + pow(uAxes.y * dot(eb, n), 2.0));
  float w = mix(2.5, wP, clamp(t, 0.0, 1.0));
  float s = d / w;

  float edge = 1.0 - smoothstep(1.0 - uSoft, 1.0, abs(s));
  // Light scattered sideways by the haze: a dim glow hugging the shaft.
  float scatter = 1.0 - smoothstep(0.6, 2.6, abs(s));
  float along = smoothstep(0.0, 0.03, t) * (1.0 - smoothstep(0.96, 1.06, t));

  vec2 hp = p * 0.0032 + vec2(uTime * 0.011, -uTime * 0.017);
  float h = fbm(hp);
  float haze = smoothstep(0.2, 0.9, h) * 1.7;

  float g = 1.0;
  if (uGobo > 0.5 && uGobo < 1.5) g = 0.45 + 0.55 * smoothstep(0.35, 0.7, fbm(vec2(s * 2.6 + uSpin * 0.5, t * 0.7 + 3.0)));
  else if (uGobo > 1.5 && uGobo < 2.5) g = 0.4 + 0.6 * smoothstep(0.15, 0.85, 0.5 + 0.5 * cos(s * 15.0 + uSpin * 2.0));
  else if (uGobo > 2.5) g = 0.25 + 0.75 * smoothstep(0.45, 0.9, abs(s));

  float fall = mix(1.5, 0.5, clamp(t, 0.0, 1.0));
  float shaft = (edge * g + scatter * 0.22) * along * haze * fall * uHaze;

  /* The pool and what leaks out of it. */
  vec2 pr = p - uPool;
  vec2 pe = vec2(dot(pr, ea) / uAxes.x, dot(pr, eb) / uAxes.y);
  float e2 = dot(pe, pe);
  float cs = cos(uSpin), sn = sin(uSpin);
  vec2 gq = vec2(cs * pe.x + sn * pe.y, -sn * pe.x + cs * pe.y);
  vec2 uv = gq * 0.5 + 0.5;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float floorPool = texture2D(uGoboTex, uv).a * inside * 0.11;
  // Optics flare and stage spill: falls off smoothly far past the field edge.
  float spill = exp(-e2 * 0.6) * 0.07 + exp(-e2 * 0.14) * 0.03 + exp(-e2 * 0.035) * 0.012;
  float bounce = exp(-e2 * 0.09) * uBounceAmt;

  float r = length(p - uLens);
  float lens = exp(-r * 0.11) * 1.1 + exp(-r * 0.025) * 0.12;

  vec3 c = uColor * ((shaft * 0.3 + lens * 0.7) + (floorPool + spill) * uPoolI) * uDim;
  c += uBounce * bounce * uPoolI * uDim;
  c += (hash(p + uTime) - 0.5) / 255.0;
  c = max(c, 0.0);
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  gl_FragColor = vec4(c, a);
}
`;

export interface ShaftFrame {
  vw: number;
  vh: number;
  lens: { x: number; y: number };
  pool: Pool;
  colour: [number, number, number];
  dim: number;
  poolI: number;
  haze: number;
  time: number;
  gobo: number;
  spin: number;
  soft: number;
  bounce: [number, number, number];
  bounceAmt: number;
}

export class Shaft {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private scale = 0.5;
  private tex: WebGLTexture | null = null;
  private texSource: HTMLCanvasElement | null = null;
  ok = true;

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    const prog = this.program();
    if (!prog) {
      this.ok = false;
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const name of [
      'uRes', 'uScale', 'uLens', 'uPool', 'uAxes', 'uAngle', 'uColor', 'uDim', 'uPoolI', 'uHaze', 'uTime',
      'uGobo', 'uSpin', 'uSoft', 'uBounce', 'uBounceAmt', 'uGoboTex',
    ]) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    this.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.uniform1i(this.u.uGoboTex, 0);
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

  /** The same gobo mask the photos are revealed through, so the floor pool matches. */
  setGobo(mask: HTMLCanvasElement) {
    if (mask === this.texSource) return;
    this.texSource = mask;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
  }

  resize(vw: number, vh: number, lowPower: boolean) {
    this.scale = Math.min(1, (devicePixelRatio || 1) * (lowPower ? 0.35 : 0.5));
    this.canvas.width = Math.max(1, Math.round(vw * this.scale));
    this.canvas.height = Math.max(1, Math.round(vh * this.scale));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(o: ShaftFrame) {
    const gl = this.gl, u = this.u;
    gl.uniform2f(u.uRes, o.vw, o.vh);
    gl.uniform1f(u.uScale, this.scale);
    gl.uniform2f(u.uLens, o.lens.x, o.lens.y);
    gl.uniform2f(u.uPool, o.pool.x, o.pool.y);
    gl.uniform2f(u.uAxes, Math.max(1, o.pool.rx), Math.max(1, o.pool.ry));
    gl.uniform1f(u.uAngle, o.pool.angle);
    gl.uniform3f(u.uColor, o.colour[0], o.colour[1], o.colour[2]);
    gl.uniform1f(u.uDim, o.dim);
    gl.uniform1f(u.uPoolI, o.poolI);
    gl.uniform1f(u.uHaze, o.haze);
    gl.uniform1f(u.uTime, o.time);
    gl.uniform1f(u.uGobo, o.gobo);
    gl.uniform1f(u.uSpin, o.spin);
    gl.uniform1f(u.uSoft, o.soft);
    gl.uniform3f(u.uBounce, o.bounce[0], o.bounce[1], o.bounce[2]);
    gl.uniform1f(u.uBounceAmt, o.bounceAmt);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
