import { clamp, lerp, setAttr, setText, setVar, Spring } from '../lib/dom';
import { LEVELS, type FieldState } from './field';
import { Fader, Filament, kelvinRgb, rgbTriplet } from './tungsten';

/*
  The one lamp: a clear tungsten bulb in a pendant lampholder, hanging on
  its flex from the top of the window. It lights the whole page.

  - Drag it up or down to dim it (or use the arrow keys); tap or press Enter
    to switch it off and on. The filament takes its time either way.
  - Brush past it and it swings; it settles like a pendulum.
  - On the cover it hangs low over the paper; as the page scrolls on it's
    flown out to the top so the light spreads into an even wash to read by,
    and at the end it comes back down.
*/

/** Where the filament sits in the drawing's own units. */
const FIL_X = 40;
const FIL_Y = 96;
/** Lux right under the lamp at full, hung low. */
const LUX_LOW = 2400;
/** Where the contour labels sit around the rings: down and to the right. */
const BEARING = (52 * Math.PI) / 180;

function filamentPath() {
  // A coiled filament slung between the two lead in wires, sagging a little through two hooks.
  const pts: string[] = [];
  const n = 150;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = 27 + 26 * t;
    const y = FIL_Y + 3.2 * Math.sin(Math.PI * t);
    const c = Math.sin(2 * Math.PI * 12.5 * t) * 1.25;
    // Offset across the line of the coil (it runs nearly level, so mostly vertical).
    pts.push(`${(x + c * 0.25).toFixed(2)} ${(y + c).toFixed(2)}`);
  }
  return `M${pts.join('L')}`;
}

function bulbSvg() {
  const fil = filamentPath();
  return `<svg class="bulb" viewBox="0 0 80 132" width="80" height="132" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="glass-glow" cx="${FIL_X}" cy="${FIL_Y - 2}" r="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" class="glow-stop-a" />
      <stop offset="1" class="glow-stop-b" />
    </radialGradient>
    <filter id="fil-blur" x="-30%" y="-300%" width="160%" height="700%"><feGaussianBlur stdDeviation="1.4" /></filter>
  </defs>
  <path class="ln" d="M32 .5h16a1.5 1.5 0 0 1 1.5 1.5v18.5h-19V2A1.5 1.5 0 0 1 32 .5z" />
  <path class="ln hair" d="M30.5 6h19M30.5 17h19" />
  <path class="ln" d="M29 20.5h22v3H29z" />
  <path class="ln" d="M32.5 23.5v13.5c0 2.2 1.6 3.8 3.4 4.4h8.2c1.8-.6 3.4-2.2 3.4-4.4V23.5" />
  <path class="ln hair" d="M32.5 26.4l15 2.1M32.5 29.8l15 2.1M32.5 33.2l15 2.1M32.5 36.6l15 2.1" />
  <circle cx="${FIL_X}" cy="${FIL_Y - 2}" r="29" fill="url(#glass-glow)" />
  <path class="glass" d="M35 41.6C35 50 13 59.5 13 88c0 18.5 12.4 32 27 32s27-13.5 27-32c0-28.5-22-38-22-46.4" />
  <path class="ln hair" d="M37.2 41.8c0 9 1.4 14.6 1.4 20.2l-1 10.4h4.8l-1-10.4c0-5.6 1.4-11.2 1.4-20.2" />
  <path class="ln hair" d="M38.6 72.4L27 ${FIL_Y}M41.4 72.4L53 ${FIL_Y}M40 72.4v8.6M40 81l-6.6 17.4M40 81l6.6 17.4" />
  <path class="fil-glow" d="${fil}" filter="url(#fil-blur)" />
  <path class="fil" d="${fil}" />
  <path class="spec" d="M21.5 74c-3 6-3.6 14-2 21" />
</svg>`;
}

export interface LampOptions {
  reduced: boolean;
  portrait: () => boolean;
}

export class Lamp {
  readonly fader = new Fader();
  readonly filament = new Filament(0.22);
  private root: HTMLElement;
  private hang: HTMLElement;
  private ctl: HTMLElement;
  private read: HTMLElement;
  private readAt: HTMLElement;
  private readK: HTMLElement;
  private labels: HTMLElement[] = [];
  private fly = new Spring(0, 0.55, 1);
  private phi = 0;
  private phiV = 0;
  /** Where the user last left the fader, so cues can hand it back. */
  private userLevel = 0.86;
  private held = false;
  private cueOwned = false;
  private lastHover: { x: number; t: number } | null = null;
  private stretch = new Spring(0, 3, 0.7);
  private pull = 0;
  state: FieldState = { x: 0, y: 0, h: 300, spread: 300, warmth: 1, bright: 0, lux: 0, glow: 0, rgb: [1, 0.6, 0.3], contour: 1, knock: [], seed: 0 };

  constructor(
    root: HTMLElement,
    private opts: LampOptions,
  ) {
    this.root = root;
    root.innerHTML = `
      <div class="lamp-hang">
        <div class="lamp-cord"></div>
        <div class="lamp-body">${bulbSvg()}</div>
        <div class="lamp-ctl" role="slider" tabindex="0" aria-label="Lamp" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <div class="lamp-read" aria-hidden="true"><span class="lamp-ch">1</span><span class="lamp-at"></span><span class="lamp-k"></span></div>
      <div class="isolux" aria-hidden="true">${LEVELS.map((l) => `<span>${l}${l === 1000 || l === 100 || l === 10 ? '<i> lx</i>' : ''}</span>`).join('')}</div>`;
    this.hang = root.querySelector('.lamp-hang')!;
    this.ctl = root.querySelector('.lamp-ctl')!;
    this.read = root.querySelector('.lamp-read')!;
    this.readAt = root.querySelector('.lamp-at')!;
    this.readK = root.querySelector('.lamp-k')!;
    this.labels = [...root.querySelectorAll<HTMLElement>('.isolux span')];
    this.bind();
  }

  /** Bring the lamp up from cold over `seconds`, the opening cue. */
  open(seconds: number) {
    if (seconds <= 0) {
      this.fader.set(this.userLevel);
      this.filament.settle(this.userLevel);
    } else this.fader.fade(this.userLevel, seconds);
  }

  /** A cue takes the lamp to a level; `restore` hands it back to where the user had it. */
  cue(level: number, seconds: number) {
    this.cueOwned = true;
    this.fader.fade(level, this.opts.reduced ? 0 : seconds);
  }
  restore(seconds: number) {
    if (!this.cueOwned) return;
    this.cueOwned = false;
    this.fader.fade(this.userLevel, this.opts.reduced ? 0 : seconds);
  }

  private setUser(level: number) {
    this.cueOwned = false;
    this.userLevel = clamp(level, 0, 1);
    this.fader.set(this.userLevel);
  }

  toggle() {
    if (this.fader.target > 0.005) {
      if (!this.cueOwned) this.userLevel = this.fader.target;
      this.cueOwned = false;
      this.fader.set(0);
    } else {
      this.setUser(this.userLevel > 0.02 ? this.userLevel : 0.86);
    }
  }

  private bind() {
    const ctl = this.ctl;
    let startY = 0;
    let startLevel = 0;
    let startT = 0;
    let moved = false;
    let id = -1;
    let lastX = 0;
    let lastT = 0;
    ctl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      id = e.pointerId;
      ctl.setPointerCapture(id);
      startY = e.clientY;
      startLevel = this.fader.target;
      startT = performance.now();
      lastX = e.clientX;
      lastT = startT;
      moved = false;
      this.held = true;
      this.root.classList.add('is-held');
      e.preventDefault();
    });
    ctl.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (this.held && e.pointerId === id) {
        const dy = startY - e.clientY;
        if (!moved && Math.abs(dy) > 4) moved = true;
        if (moved) this.setUser(startLevel + dy / 220);
        // A tug on the cord stretches it a little, and lets go.
        this.pull = clamp(-dy * 0.06, -8, 8);
        const vx = ((e.clientX - lastX) / Math.max(1, now - lastT)) * 1000;
        this.push(vx * 0.4);
        lastX = e.clientX;
        lastT = now;
        return;
      }
      // Brushing past the bulb sets it swinging.
      if (e.pointerType === 'mouse') {
        const prev = this.lastHover;
        if (prev && now - prev.t < 80) this.push(((e.clientX - prev.x) / Math.max(1, now - prev.t)) * 1000);
        this.lastHover = { x: e.clientX, t: now };
      }
    });
    ctl.addEventListener('pointerleave', () => (this.lastHover = null));
    const end = (e: PointerEvent) => {
      if (!this.held || e.pointerId !== id) return;
      this.held = false;
      this.pull = 0;
      this.root.classList.remove('is-held');
      if (!moved && performance.now() - startT < 450 && e.type === 'pointerup') this.toggle();
      id = -1;
    };
    ctl.addEventListener('pointerup', end);
    ctl.addEventListener('pointercancel', end);
    ctl.addEventListener('keydown', (e) => {
      const t = this.fader.target;
      const steps: Record<string, number> = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05, PageUp: 0.1, PageDown: -0.1 };
      if (e.key in steps) this.setUser(t + steps[e.key]);
      else if (e.key === 'Home') this.setUser(0);
      else if (e.key === 'End') this.setUser(1);
      else if (e.key === 'Enter' || e.key === ' ') this.toggle();
      else return;
      e.preventDefault();
    });
  }

  /** Give the pendulum a shove from a horizontal speed in px/s. */
  private push(vx: number) {
    if (this.opts.reduced) return;
    this.phiV = clamp(this.phiV + vx * 0.00009, -0.5, 0.5);
  }

  /**
   * One frame. `flyTarget` is 0 for hung low over the cover, 1 for flown out
   * to the top.
   */
  update(dt: number, flyTarget: number, vw: number, vh: number, seed: number) {
    const portrait = this.opts.portrait();
    this.fader.step(dt);
    const f = this.filament;
    if (this.opts.reduced) f.settle(this.fader.level);
    else f.step(this.fader.level, dt);

    const fly = this.opts.reduced ? (this.fly.set(flyTarget), flyTarget) : this.fly.step(flyTarget, dt);
    const scale = portrait ? 0.95 : 1.3;
    const x0 = vw * (portrait ? 0.76 : 0.63);
    const low = portrait ? Math.max(170, vh * 0.27) : Math.max(250, vh * 0.42);
    // Flown out it hangs just under the top edge; on a phone, where the nav
    // needs the room, it goes right out of sight and only its light is left.
    const high = portrait ? -36 : 96 * scale + 6;
    const stretch = this.stretch.step(this.pull, dt);
    const len = lerp(low, high, fly) + stretch;

    // Pendulum on its flex: a longer flex swings slower.
    if (!this.opts.reduced) {
      const w = Math.sqrt(9.81 / Math.max(0.6, len / 380)) * 0.9;
      let left = Math.min(dt, 0.1);
      while (left > 0) {
        const h = Math.min(left, 1 / 120);
        this.phiV += (-w * w * Math.sin(this.phi) - 2 * 0.05 * w * this.phiV) * h;
        this.phi += this.phiV * h;
        left -= h;
      }
    }
    const fx = x0 + len * Math.sin(this.phi);
    const fy = len * Math.cos(this.phi);

    // Negative once the lampholder is above the top of the window.
    const cordLen = len - FIL_Y * scale;
    const hangT = `translate3d(${x0.toFixed(2)}px,0,0) rotate(${this.phi.toFixed(4)}rad)`;
    if (this.hang.style.transform !== hangT) this.hang.style.transform = hangT;
    setVar(this.hang, '--cord', `${cordLen.toFixed(2)}px`);
    setVar(this.hang, '--scale', String(scale));

    const rgb = kelvinRgb(Math.max(f.kelvin, 1000));
    const glow = f.glow;
    const bright = f.bright;
    setVar(document.documentElement, '--lamp', rgbTriplet(rgb));
    setVar(document.documentElement, '--glow', glow.toFixed(3));
    setVar(document.documentElement, '--lit', bright.toFixed(3));
    // The wire is grey when cold; hot, it's nearly white with the lamp's colour in it.
    const hot = Math.min(1, glow * 1.4);
    const fil: [number, number, number] = [0, 1, 2].map((i) => lerp(0.42, lerp(rgb[i], 1, 0.55), hot)) as [number, number, number];
    setVar(document.documentElement, '--fil', rgbTriplet(fil));

    // Readout: the channel at its level, the way a desk shows it, and the filament's actual colour temperature.
    const lv = Math.round(this.fader.level * 100);
    setText(this.readAt, lv >= 100 ? 'FL' : String(lv));
    setText(this.readK, f.kelvin > 800 ? `${Math.round(f.kelvin / 10) * 10} K` : '');
    // The readout sits beside the glass: to the right, or on a phone (lamp near the right edge) to the left.
    this.read.classList.toggle('is-left', portrait);
    const rx = portrait ? fx - 32 * scale : fx + 32 * scale;
    const ry = fy + 2;
    const readT = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    if (this.read.style.transform !== readT) this.read.style.transform = readT;
    const tl = Math.round(this.fader.target * 100);
    setAttr(this.ctl, 'aria-valuenow', String(tl));
    setAttr(this.ctl, 'aria-valuetext', tl === 0 ? 'Off' : `${tl} percent`);

    // Light on the paper. Flown out it's further away: a wider pool, fewer lux.
    const hLow = portrait ? vh * 0.3 : Math.min(vw, vh) * 0.36;
    const hHigh = Math.max(vw, vh) * 0.78;
    const h = lerp(hLow, hHigh, fly);
    const lux = LUX_LOW * f.output * (hLow / h) * (hLow / h);
    const contour = lerp(1, 0.42, fly);
    // The colour of the light stays a pool round the lamp rather than flooding the page.
    const spread = lerp(hLow, hLow * 1.5, fly);
    const warmth = lerp(1, 0.5, fly);

    // Contour labels sit on their rings, turned along them, down and to the right.
    const knock: [number, number, number][] = [];
    const bearing = portrait ? (66 * Math.PI) / 180 : BEARING;
    const cos = Math.cos(bearing);
    const sin = Math.sin(bearing);
    const rot = ((bearing * 180) / Math.PI - 90).toFixed(1);
    LEVELS.forEach((L, i) => {
      const el = this.labels[i];
      const ok = lux > L / 0.82;
      const r = ok ? h * Math.sqrt(Math.pow(lux / L, 2 / 3) - 1) : 0;
      const x = fx + r * cos;
      const y = fy + r * sin;
      const show = ok && r > 34 && x < vw - 44 && y < vh - 30 && x > 44 && y > 30;
      const a = show ? contour * Math.min(1, (r - 34) / 30) : 0;
      setVar(el, '--a', a.toFixed(3));
      if (show) {
        const t = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) rotate(${rot}deg)`;
        if (el.style.transform !== t) el.style.transform = t;
        knock.push([x, y, (el.textContent!.length * 5.6) / 2 + 3]);
      }
    });

    this.state = { x: fx, y: fy, h, spread, warmth, bright, lux, glow, rgb, contour, knock, seed };
    return this.state;
  }

  /** Light falling on a point of the page, 0..1, for things that want to catch it. */
  lightAt(x: number, y: number) {
    const s = this.state;
    const r2 = (x - s.x) ** 2 + (y - s.y) ** 2;
    return s.bright * Math.pow((s.h * s.h) / (r2 + s.h * s.h), 1.5);
  }
}

