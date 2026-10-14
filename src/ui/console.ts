import { GOBOS, type Settings } from '../engine/rig';

interface FaderDef {
  key: keyof Settings;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Map settings value to slider value and back. */
  to: (v: number) => number;
  from: (v: number) => number;
  fmt: (v: number) => string;
}

const FADERS: FaderDef[] = [
  { key: 'dimmer', label: 'Dimmer', min: 0, max: 100, step: 1, to: (v) => v * 100, from: (v) => v / 100, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'zoom', label: 'Zoom', min: 8, max: 42, step: 1, to: (v) => v, from: (v) => v, fmt: (v) => `${Math.round(v)}°` },
  { key: 'cct', label: 'Colour', min: 2700, max: 6500, step: 100, to: (v) => v, from: (v) => v, fmt: (v) => `${Math.round(v)} K` },
  { key: 'haze', label: 'Haze', min: 0, max: 100, step: 1, to: (v) => v * 100, from: (v) => v / 100, fmt: (v) => `${Math.round(v * 100)}%` },
];

export interface DeskHandlers {
  change: (s: Partial<Settings>) => void;
  go: (dir: 1 | -1) => void;
}

export class Desk {
  private outputs = new Map<string, HTMLOutputElement>();
  private inputs = new Map<string, HTMLInputElement>();
  private cueOut!: HTMLElement;
  private panel!: HTMLElement;
  private toggle!: HTMLButtonElement;

  constructor(root: HTMLElement, settings: Settings, goboIcons: string[], h: DeskHandlers, startOpen: boolean) {
    root.innerHTML = `
      <button class="desk-toggle" type="button" aria-expanded="${startOpen}" aria-controls="desk-panel">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3v14M10 3v14M16 3v14" /><rect x="2.5" y="10" width="3" height="3" /><rect x="8.5" y="5" width="3" height="3" /><rect x="14.5" y="12" width="3" height="3" /></svg>
        <span>Console</span>
      </button>
      <div class="desk-panel" id="desk-panel" ${startOpen ? '' : 'hidden'}>
        <div class="faders"></div>
        <fieldset class="gobos">
          <legend>Gobo</legend>
          <div class="gobo-row"></div>
        </fieldset>
        <div class="cue">
          <button class="cue-back" type="button" aria-label="Previous show">Back</button>
          <button class="cue-go" type="button" aria-label="Next show">Go</button>
          <p class="cue-name" aria-live="polite"></p>
        </div>
      </div>`;
    this.panel = root.querySelector('.desk-panel')!;
    this.toggle = root.querySelector('.desk-toggle')!;
    this.toggle.addEventListener('click', () => this.setOpen(this.panel.hidden));

    const faders = root.querySelector('.faders')!;
    for (const f of FADERS) {
      const id = `fader-${f.key}`;
      const wrap = document.createElement('div');
      wrap.className = 'fader';
      wrap.innerHTML = `
        <output for="${id}"></output>
        <input id="${id}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" />
        <label for="${id}">${f.label}</label>`;
      const input = wrap.querySelector('input')!;
      const out = wrap.querySelector('output')!;
      input.value = String(f.to(settings[f.key] as number));
      out.textContent = f.fmt(settings[f.key] as number);
      input.addEventListener('input', () => {
        const v = f.from(Number(input.value));
        out.textContent = f.fmt(v);
        h.change({ [f.key]: v });
      });
      this.inputs.set(f.key, input);
      this.outputs.set(f.key, out);
      faders.append(wrap);
    }

    const row = root.querySelector('.gobo-row')!;
    GOBOS.forEach((name, i) => {
      const lab = document.createElement('label');
      lab.className = 'gobo';
      lab.innerHTML = `<input type="radio" name="gobo" value="${i}" ${settings.gobo === i ? 'checked' : ''} />
        <img src="${goboIcons[i]}" alt="" width="22" height="22" /><span>${name}</span>`;
      lab.querySelector('input')!.addEventListener('change', () => h.change({ gobo: i }));
      row.append(lab);
    });

    this.cueOut = root.querySelector('.cue-name')!;
    root.querySelector('.cue-go')!.addEventListener('click', () => h.go(1));
    root.querySelector('.cue-back')!.addEventListener('click', () => h.go(-1));
  }

  setOpen(open: boolean) {
    this.panel.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
  }

  setCue(n: number, name: string) {
    this.cueOut.textContent = `Cue ${n}, ${name}`;
  }

  set(key: keyof Settings, v: number) {
    const f = FADERS.find((x) => x.key === key);
    if (!f) return;
    this.inputs.get(key)!.value = String(f.to(v));
    this.outputs.get(key)!.textContent = f.fmt(v);
  }
}
