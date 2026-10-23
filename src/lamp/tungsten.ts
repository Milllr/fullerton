/*
  A tungsten lamp on a dimmer, worked out the way the filament really
  behaves, so an LD recognises it on sight.

  The fader sets the voltage across the lamp. The filament doesn't follow
  at once: it heats by Joule heating and cools by radiation (which goes as
  T to the fourth), so it comes up quickly and dies away slowly, glowing red
  for a moment after it's switched off. At equilibrium T goes as V to the
  0.4, which is the textbook colour temperature law for tungsten (CCT about
  V^0.42), and light output as T^8.5 (about V^3.4). Dim it and it goes
  amber, then orange, then a deep red before it goes out.
*/

/** Colour temperature at full. Warmer than a 3200 K stage lamp, cooler than a household bulb. */
export const FULL_K = 2900;
/** Below about 800 K (the Draper point) a filament gives no light you can see. */
const DRAPER = 798 / FULL_K;

export class Filament {
  /** Filament temperature as a fraction of its temperature at full. */
  theta = 0;
  /** Thermal time constant in seconds: how heavy the filament is. */
  constructor(public tau = 0.22) {}

  step(volts: number, dt: number) {
    const heat = Math.pow(Math.max(0, Math.min(1, volts)), 1.6);
    let t = this.theta;
    let left = Math.min(dt, 0.25);
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      t += ((heat - t * t * t * t) / this.tau) * h;
      left -= h;
    }
    this.theta = Math.max(0, t);
  }

  /** Jump straight to the temperature this voltage settles at. */
  settle(volts: number) {
    this.theta = Math.pow(Math.max(0, volts), 0.4);
  }

  get kelvin() {
    return FULL_K * this.theta;
  }
  /** Light output, 1 at full. Steep: half voltage gives about a tenth of the light. */
  get output() {
    return Math.pow(this.theta, 8.5);
  }
  /** Brightness as the eye takes it (roughly the cube root of output), 1 at full. */
  get bright() {
    return Math.pow(this.theta, 3.4);
  }
  /** How much the filament itself glows, from nothing at the Draper point up. */
  get glow() {
    const t = Math.max(0, (this.theta - DRAPER) / (1 - DRAPER));
    return t * t;
  }
}

/** Black body colour for a temperature in kelvin, sRGB 0..1 (Tanner Helland's fit). */
export function kelvinRgb(k: number): [number, number, number] {
  const t = Math.max(k, 600) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

export const rgbTriplet = ([r, g, b]: [number, number, number]) =>
  `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;

/**
 * The fader: where the dimmer is set. Cues fade it with an S curve; a hand
 * on the lamp sets it directly. The filament does the rest.
 */
export class Fader {
  level = 0;
  private from = 0;
  private to = 0;
  private t = 0;
  private time = 0;

  fade(to: number, seconds: number) {
    this.from = this.level;
    this.to = Math.max(0, Math.min(1, to));
    this.t = 0;
    this.time = Math.max(0, seconds);
    if (this.time === 0) this.level = this.to;
  }

  set(level: number) {
    this.level = this.to = Math.max(0, Math.min(1, level));
    this.time = 0;
  }

  get fading() {
    return this.time > 0 && this.t < 1;
  }

  get target() {
    return this.to;
  }

  step(dt: number) {
    if (this.time <= 0 || this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / this.time);
    const s = this.t * this.t * (3 - 2 * this.t);
    this.level = this.from + (this.to - this.from) * s;
  }
}
