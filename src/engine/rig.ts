import { kelvinToRgb } from './kelvin';

export interface Pool {
  /** Centre of the pool on the page, in viewport px. */
  x: number;
  y: number;
  /** Semi-axis along the beam's direction of travel. */
  rx: number;
  /** Semi-axis across the beam. */
  ry: number;
  /** Angle of rx in radians. */
  angle: number;
}

export type Mode = 'follow' | 'idle' | 'cue' | 'rest';

export interface Settings {
  dimmer: number; // 0..1
  zoom: number; // full beam angle in degrees
  cct: number; // kelvin
  haze: number; // 0..1
  gobo: number; // 0 open, 1 breakup, 2 dots, 3 ring
}

export const GOBOS = ['Open', 'Breakup', 'Dots', 'Ring'] as const;

const TAU = Math.PI * 2;

/**
 * One moving head hung in front of the page. The page is the wall it lights.
 * Pan and tilt are driven by a critically damped spring with capped speed, so
 * the head moves with weight and never snaps.
 */
export class Rig {
  settings: Settings = { dimmer: 0.88, zoom: 19, cct: 4700, haze: 0.5, gobo: 0 };
  /** Output level after the opening cue and blackout are applied. */
  level = 0;
  /** Extra zoom on top of the fader, used by cues (degrees). */
  zoomBoost = 0;
  goboSpin = 0;

  /** Pivot of the head on screen (centre of the tilt axis). */
  pivot = { x: 0, y: 0 };
  /** Throw distance from the head to the page, in px. */
  throw = 1000;

  pan = 0;
  tilt = 0;
  private vPan = 0;
  private vTilt = 0;

  target = { x: 0, y: 0 };
  mode: Mode = 'rest';
  idleClock = 0;
  reducedMotion = false;

  /** Spring stiffness. Lower is heavier. */
  omega = 5.2;
  maxPan = 2.4; // rad/s
  maxTilt = 1.9;

  /** Narrows the beam on small screens so the pool stays in proportion. */
  zoomScale = 1;

  layout(vw: number, vh: number, pivotX: number, pivotY: number) {
    this.pivot.x = pivotX;
    this.pivot.y = pivotY;
    this.throw = Math.max(vh, 640) * 1.15;
    this.zoomScale = Math.max(0.42, Math.min(1, vw / 1300));
  }

  anglesFor(x: number, y: number) {
    const dx = x - this.pivot.x;
    const dy = y - this.pivot.y;
    const D = this.throw;
    return { pan: Math.atan2(dx, D), tilt: Math.atan2(dy, Math.hypot(dx, D)) };
  }

  /** Put the head straight onto a point, used once at start. */
  aimNow(x: number, y: number) {
    const a = this.anglesFor(x, y);
    this.pan = a.pan;
    this.tilt = a.tilt;
    this.vPan = this.vTilt = 0;
    this.target = { x, y };
  }

  update(dt: number, vw: number, vh: number) {
    dt = Math.min(dt, 0.05);
    if (this.mode === 'idle' && !this.reducedMotion) {
      this.idleClock += dt;
      // A slow figure across the viewport: 24 s across, 16 s up and down.
      const t = this.idleClock;
      this.target.x = vw / 2 + vw * 0.3 * Math.sin((TAU * t) / 24);
      this.target.y = vh * 0.56 + vh * 0.2 * Math.sin((TAU * t) / 16 + 0.9);
    }
    const a = this.anglesFor(this.target.x, this.target.y);
    const w = this.omega;
    const step = (pos: number, vel: number, goal: number, vmax: number) => {
      const acc = w * w * (goal - pos) - 2 * w * vel;
      vel = Math.max(-vmax, Math.min(vmax, vel + acc * dt));
      return [pos + vel * dt, vel];
    };
    [this.pan, this.vPan] = step(this.pan, this.vPan, a.pan, this.maxPan);
    [this.tilt, this.vTilt] = step(this.tilt, this.vTilt, a.tilt, this.maxTilt);
    if (!this.reducedMotion && this.settings.gobo !== 0) this.goboSpin += dt * 0.22;
  }

  /** Unit vector the head is pointing along (x right, y down, z toward viewer). */
  direction() {
    const cp = Math.cos(this.pan), sp = Math.sin(this.pan);
    const ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
    return { x: ct * sp, y: st, z: -ct * cp };
  }

  pool(): Pool {
    const D = this.throw;
    const cp = Math.cos(this.pan), ct = Math.cos(this.tilt);
    const x = this.pivot.x + D * Math.tan(this.pan);
    const y = this.pivot.y + (D * Math.tan(this.tilt)) / cp;
    const dist = D / (cp * ct);
    const half = ((this.settings.zoom * this.zoomScale + this.zoomBoost) / 2) * (Math.PI / 180);
    const r = dist * Math.tan(half);
    const inc = Math.max(0.35, cp * ct);
    const d = this.direction();
    const angle = Math.hypot(d.x, d.y) < 1e-4 ? 0 : Math.atan2(d.y, d.x);
    return { x, y, rx: r / inc, ry: r, angle };
  }

  colour() {
    return kelvinToRgb(this.settings.cct);
  }

  /** Effective intensity 0..1. */
  intensity() {
    return this.settings.dimmer * this.level;
  }
}
