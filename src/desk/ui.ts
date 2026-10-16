import {
  ATTRS, FEATURES, FIXTURES, PRESETS, SPOTS, listName, strobeHz,
  type AttrKey, type Desk, type Feature, type Preset, type Source,
} from './model';
import { echo, execute, looksLikeError, type Result } from './commandline';
import { kelvinToRgb, rgbCss } from '../engine/kelvin';
import { setAttr, setClass, setText, setVar } from '../engine/css';

export type Live = Record<number, { pan: number; tilt: number }>;

/*
  A grandMA3, screens and console.

  The screen follows the grandMA3 user manual (help.malighting.com): a fixture
  sheet, a Dynamic preset pool that follows the feature group, the sequence
  sheet, the encoder bar with its feature group control bar and the Grand
  Master at its right edge, and the command line along the bottom. The MA logo
  in title fields is replaced by a neutral glyph.

  The console: backlit keys whose legends light when they're on, dual
  encoders with a light under each, executors 201 to 204 with their labels on
  a letterbox screen, the large Pause, Go- and Go+. As on a grandMA3 there is
  no Goto or B.O. key and no Grand Master fader; Black on the command line
  blacks out.
*/
/** The logged in user, as the command line prompt shows it. */
const USER = 'James';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type KeyAction =
  | { kind: 'type'; text: string }
  | { kind: 'do'; act: 'full' | 'highlight' | 'blind' | 'oops' | 'clear' | 'esc' | 'please' | 'help' };

/** Command keys. A grandMA3 has no Goto key; Help sits in that place. */
const PROG_KEYS: { label: string; act: KeyAction; lit?: string }[] = [
  { label: 'Fixture', act: { kind: 'type', text: 'Fixture ' } },
  { label: 'Preset', act: { kind: 'type', text: 'Preset ' } },
  { label: 'Cue', act: { kind: 'type', text: 'Cue ' } },
  { label: 'Exec', act: { kind: 'type', text: 'Executor ' } },
  { label: 'Store', act: { kind: 'type', text: 'Store ' } },
  { label: 'Help', act: { kind: 'do', act: 'help' } },
  { label: 'At', act: { kind: 'type', text: ' At ' } },
  { label: 'Thru', act: { kind: 'type', text: ' Thru ' } },
  { label: 'Full', act: { kind: 'do', act: 'full' } },
  { label: 'Off', act: { kind: 'type', text: 'Off ' } },
  { label: 'Highlt', act: { kind: 'do', act: 'highlight' }, lit: 'hi' },
  { label: 'Blind', act: { kind: 'do', act: 'blind' }, lit: 'blind' },
  { label: 'Oops', act: { kind: 'do', act: 'oops' } },
  { label: 'Clear', act: { kind: 'do', act: 'clear' }, lit: 'clear' },
  { label: 'Esc', act: { kind: 'do', act: 'esc' } },
];

/** The numeric keys: + and - down the right, Please under them, 0 wide. */
const KEYPAD = ['7', '8', '9', '+', '4', '5', '6', '-', '1', '2', '3', '0', '.'];

/** Fixture sheet columns: one per attribute, as the sheet lists them. */
const SHEET: { attr: AttrKey; label: string }[] = [
  { attr: 'dim', label: 'Dim' },
  { attr: 'pan', label: 'Pan' },
  { attr: 'tilt', label: 'Tilt' },
  { attr: 'gobo', label: 'Gobo1' },
  { attr: 'goboRot', label: 'G1 Rot' },
  { attr: 'cct', label: 'CTC' },
  { attr: 'shutter', label: 'Shutter' },
  { attr: 'iris', label: 'Iris' },
  { attr: 'zoom', label: 'Zoom' },
  { attr: 'focus', label: 'Focus' },
  { attr: 'frost', label: 'Frost' },
  { attr: 'haze', label: 'Haze' },
  { attr: 'fan', label: 'Fan' },
];

/** Preset pool per feature group, numbered as the pools are. */
const POOL_OF: Record<Feature, number> = { Dimmer: 1, Position: 2, Gobo: 3, Color: 4, Beam: 5, Focus: 6, Control: 7 };

/*
  grandMA3 value colours (manual, Colors: System Colors):
  active programmer values white on red, inactive programmer values red on
  gray, the selected sequence's current cue cyan, other playbacks yellow,
  defaults light gray, attributes the fixture doesn't have black.
*/
function valueClass(src: Source, v: number) {
  switch (src) {
    case 'programmer': return 'v-prog';
    case 'inactive': return 'v-inact';
    case 'cue': return 'v-cue';
    case 'executor': return v > 0.05 ? 'v-exec' : 'v-def';
    case 'highlight': return 'v-hi';
    default: return 'v-def';
  }
}

/** Sheet readouts: plain numbers, as a fixture sheet shows them. */
function sheetFmt(a: AttrKey, v: number) {
  switch (a) {
    case 'pan':
    case 'tilt':
    case 'zoom':
      return v.toFixed(1);
    case 'gobo':
    case 'goboRot':
      return ATTRS[a].fmt(v);
    case 'shutter':
      return v < 0.5 ? 'Open' : `${strobeHz(v).toFixed(1)} Hz`;
    default:
      return String(Math.round(v));
  }
}

/* Small line icons for the pool title fields. Our own drawings, not MA's. */
const svg = (d: string) => `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const POOL_ICON: Record<Feature, string> = {
  Dimmer: svg('<circle cx="8" cy="8" r="3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>'),
  Position: svg('<circle cx="8" cy="8" r="5"/><path d="M8 1v4M8 11v4M1 8h4M11 8h4"/>'),
  Gobo: svg('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="5" r="1.2"/><circle cx="5.4" cy="9.5" r="1.2"/><circle cx="10.6" cy="9.5" r="1.2"/>'),
  Color: svg('<circle cx="6" cy="6.5" r="3.6"/><circle cx="10" cy="6.5" r="3.6"/><circle cx="8" cy="10" r="3.6"/>'),
  Beam: svg('<path d="M3 2.5h3M4.5 2.5L1.5 14h10L6 2.5"/>'),
  Focus: svg('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.6"/>'),
  Control: svg('<path d="M3 4h10M3 8h10M3 12h10"/><circle cx="6" cy="4" r="1.3"/><circle cx="10" cy="8" r="1.3"/><circle cx="7" cy="12" r="1.3"/>'),
};
/** Stands where the MA logo sits in title fields. */
const GLYPH = '<i class="glyph" aria-hidden="true"><b></b><b></b><b></b><b></b></i>';

interface Enc {
  /** The physical encoder. */
  root: HTMLElement;
  knob: HTMLElement;
  led: HTMLElement;
  /** Its field in the encoder bar on screen. */
  field: HTMLButtonElement;
  name: HTMLElement;
  val: HTMLElement;
  /** Its mirror in the bar, shown while the desk is closed. */
  mini: { name: HTMLElement; val: HTMLElement; root: HTMLElement };
  attr: AttrKey | null;
  rot: number;
}

interface Fader {
  id: 'e1' | 'e2' | 'e3' | 'e4';
  input: HTMLInputElement;
  lcd: HTMLElement;
  bar: HTMLElement | null;
  shown: number;
  dragging: boolean;
}

interface Cell {
  fx: number;
  attr: AttrKey;
  el: HTMLElement;
}

export class DeskUI {
  private root: HTMLElement;
  private desk: Desk;
  private reduced: boolean;
  private cmd!: HTMLInputElement;
  private fb!: HTMLElement;
  private scroller!: HTMLElement;
  private screen!: HTMLElement;
  private hw!: HTMLElement;
  private handle!: HTMLButtonElement;
  private encs: Enc[] = [];
  private faders: Fader[] = [];
  private cells: Cell[] = [];
  private rows: { id: number; tr: HTMLElement; btn: HTMLElement }[] = [];
  private gmEl!: HTMLElement;
  private history: string[] = [];
  private hIdx = -1;
  private live: Live = { 1: { pan: 0, tilt: 30 }, 2: { pan: 0, tilt: 30 } };
  private goboIcons: string[];
  private poolSlots = 0;
  private poolColCount = 0;
  private xlCues: [HTMLElement, HTMLElement] | null = null;
  private lastCue: number | null | undefined = undefined;
  private fade = { cue: null as number | null, t: 0, dur: 0, bar: null as HTMLElement | null };
  private progOnly = false;
  isOpen = false;
  onOpenChange: (open: boolean) => void = () => {};

  constructor(root: HTMLElement, desk: Desk, goboIcons: string[], reduced: boolean) {
    this.root = root;
    this.desk = desk;
    this.goboIcons = goboIcons;
    this.reduced = reduced;
    this.build();
    desk.subscribe(() => this.render());
    this.render();
    this.say({ ok: true, msg: 'Type Help for commands' });
  }

  /* --------------------------------------------------------------- build */

  private build() {
    // A key; `lit` names the state that lights its legend.
    const key = (label: string, attrs = '', lit?: string) => {
      // Fold any extra classes into the one class attribute.
      const extra = attrs.match(/class="([^"]*)"/)?.[1] ?? '';
      const rest = attrs.replace(/class="[^"]*"\s*/, '');
      const cls = ['key', ...extra.split(/\s+/).filter((c) => c && c !== 'key')].join(' ');
      return `<button class="${cls}" type="button" ${lit ? `data-lit="${lit}" ` : ''}${rest}><span>${label}</span></button>`;
    };

    const mini = [0, 1, 2, 3, 4].map((i) => `<button class="mini-lcd" type="button" data-mini="${i}" tabindex="-1"><i class="ef-bar"></i><span class="ef-name"></span><span class="ef-val"></span></button>`).join('');
    // Each field carries the encoder icon; its centre shows the resolution.
    const fields = [0, 1, 2, 3, 4].map((i) => `<button class="ef" type="button" data-ef="${i}"><i class="ef-bar"></i><span class="ef-name"></span><span class="ef-val"></span><i class="ef-res" aria-hidden="true"></i></button>`).join('');
    const knobs = [0, 1, 2, 3, 4]
      .map(
        (i) => `<div class="enc" data-enc="${i}">
          <div class="knob" role="slider" tabindex="0" aria-label="Encoder ${i + 1}"><span class="knob-ring"></span><span class="knob-cap"></span></div>
          <i class="enc-led" aria-hidden="true"></i>
        </div>`,
      )
      .join('');

    // An executor: its label (a section of the letterbox screen), its fader,
    // the key under the fader (two lines) and the one below it (one line).
    const exec = (id: string, n: number, label: string, keys: string, cues = false) => `
      <div class="exec" data-exec="${id}">
        <div class="exec-keys">${keys}</div>
        <div class="exec-lcd lcd" aria-hidden="true">
          <i class="xl-top"></i><span class="xl-num">${200 + n}</span><span class="xl-idx">${n}</span>
          <span class="lcd-name">${label}</span>
          ${cues ? '<span class="xl-cues"><span class="xl-c1"></span><span class="xl-c2"></span></span>' : ''}
          <span class="lcd-val"></span>
          <span class="xl-bar"><i></i></span>
        </div>
        <div class="fader">
          <span class="fader-scale" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          <input type="range" min="0" max="100" step="1" aria-label="${label} fader" />
        </div>
      </div>`;

    // As the fixture sheet orders them: Name, FID, IDType, CID, then the attributes.
    const sheetHead = `<tr><th class="fs-name" scope="col">Name</th><th class="fs-fid" scope="col">FID</th><th class="fs-idt" scope="col">IDType</th><th class="fs-cid" scope="col">CID</th>${SHEET.map((c) => `<th scope="col">${c.label}</th>`).join('')}</tr>`;
    const sheetRows = FIXTURES.map(
      (f) => `<tr data-row="${f.id}"><td class="fs-name"><button type="button" data-fixture="${f.id}" aria-pressed="false">${f.name}</button></td><td class="fs-fid">${f.id}</td><td class="fs-idt">Fixture</td><td class="fs-cid"></td>${SHEET.map(
        (c) => `<td class="fs-v${f.attrs.includes(c.attr) ? '' : ' v-none'}" data-a="${c.attr}"></td>`,
      ).join('')}</tr>`,
    ).join('');

    this.root.classList.add('ma3', 'is-shut');
    this.root.innerHTML = `
      <div class="desk-scroll">
        <div class="desk-screen" id="desk-screen" hidden>
          <div class="windows">
            <section class="win fsheet" aria-label="Fixture sheet">
              <header class="win-title">${GLYPH}<span class="wt-name">Fixtures</span>
                <span class="wt-tools"><button type="button" class="wt-btn" data-progonly aria-pressed="false">Prog Only</button><span class="wt-btn is-inert">Part</span><span class="wt-btn is-inert">Readout</span><span class="wt-btn is-inert">Step</span></span>
              </header>
              <div class="fs-scroll"><table class="fs-table"><thead>${sheetHead}</thead><tbody>${sheetRows}</tbody></table></div>
            </section>
            <section class="win pool" aria-label="Preset pool, Dynamic">
              <div class="pool-grid"></div>
            </section>
            <section class="win seqsheet" aria-label="Sequence 1 Shows">
              <header class="win-title">${GLYPH}<span class="wt-name"><b>1</b> Shows</span></header>
              <div class="cue-scroll"><table class="cue-table"><thead><tr><th class="cs-no">No</th><th class="cs-part">Part</th><th>Name</th><th class="cs-fade">CueIn Fade</th><th class="cs-delay">CueIn Delay</th></tr></thead><tbody></tbody></table></div>
            </section>
          </div>
          <div class="encbar">
            <div class="fgcb" role="tablist" aria-label="Feature groups"></div>
            <div class="enc-row">
              <div class="enc-page">
                <button class="ep" type="button" aria-label="Next feature"><span class="ep-name"></span><span class="ep-count"></span></button>
              </div>
              <div class="enc-fields">${fields}</div>
              <div class="layers" aria-label="Layer: Absolute">
                <span class="ly ly-abs is-on">Absolute</span><span class="ly ly-rel">Relative</span><span class="ly ly-fade">Fade</span><span class="ly ly-delay">Delay</span>
              </div>
              <div class="sgm" role="slider" tabindex="0" aria-label="Grand Master" aria-valuemin="0" aria-valuemax="100">
                <span class="sgm-title">Grand</span><span class="sgm-fill"><i></i></span><span class="sgm-val"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="desk-bar">
          <div class="cmd">
            <div class="cmd-field">
              <label class="cmd-prompt" for="cmd-input"><span class="cmd-user">${USER}</span><span class="cmd-kw">[Fixture]</span>&gt;</label>
              <input id="cmd-input" class="cmd-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" />
            </div>
            <p class="cmd-fb" aria-live="polite"></p>
          </div>
          <div class="bar-lcds">${mini}</div>
          <div class="bar-go">
            ${key('Go-', 'data-act="goback" aria-label="Go back one cue"')}
            ${key('Go+', 'class="key key-go" data-act="go" aria-label="Go to next cue"', 'go')}
          </div>
          <i class="session" title="Network session: standalone" aria-hidden="true"></i>
          <button class="desk-handle" type="button" aria-expanded="false" aria-controls="desk-screen desk-hw">
            <span class="grip" aria-hidden="true"></span><span class="handle-label">Desk</span>
          </button>
        </div>

        <div class="desk-hw" id="desk-hw" hidden>
          <div class="encoders">${knobs}<span class="enc-spacer" aria-hidden="true"></span></div>
          <div class="execs">
            ${exec('e1', 1, 'Shows', key('Go+', 'class="xk2" data-act="go"', 'go') + key('Go-', 'class="xk1" data-act="goback"'), true)}
            ${exec('e2', 2, 'Hazer', key('Flash', 'class="xk2" data-flash="2"', 'f2') + key('Off', 'class="xk1" data-off="2"'))}
            ${exec('e3', 3, 'Sweep', key('Flash', 'class="xk2" data-flash="3"', 'f3') + key('Off', 'class="xk1" data-off="3"'))}
            ${exec('e4', 4, 'Fill', key('Flash', 'class="xk2" data-flash="4"', 'f4') + key('Off', 'class="xk1" data-off="4"'))}
          </div>
          <div class="keys">
            <div class="prog-keys">${PROG_KEYS.map((k, i) => key(k.label, `data-pk="${i}"`, k.lit)).join('')}</div>
            <div class="keypad">${KEYPAD.map((k) => key(k, `data-kp="${k}"`)).join('')}${key('Please', 'class="key key-please" data-act="please"')}</div>
          </div>
          <div class="master">
            ${key('Pause', 'class="key key-pause" data-act="pause"', 'pause')}
            ${key('Go-', 'class="key key-goback" data-act="goback"')}
            ${key('Go+', 'class="key key-go key-big" data-act="go"', 'go')}
          </div>
        </div>
      </div>`;

    const $ = <T extends HTMLElement = HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.cmd = $<HTMLInputElement>('.cmd-input');
    this.fb = $('.cmd-fb');
    this.scroller = $('.desk-scroll');
    this.screen = $('.desk-screen');
    this.hw = $('.desk-hw');
    this.handle = $<HTMLButtonElement>('.desk-handle');
    this.gmEl = $('.sgm');

    this.handle.addEventListener('click', () => this.setOpen(!this.isOpen));
    this.cmd.addEventListener('keydown', (e) => this.cmdKey(e));

    // Fixture sheet cells, kept so they can be repainted without rebuilding.
    this.root.querySelectorAll<HTMLElement>('.fs-table tbody tr').forEach((tr) => {
      const id = Number(tr.dataset.row);
      this.rows.push({ id, tr, btn: tr.querySelector('button')! });
      tr.querySelectorAll<HTMLElement>('td[data-a]').forEach((el) => {
        if (!el.classList.contains('v-none')) this.cells.push({ fx: id, attr: el.dataset.a as AttrKey, el });
      });
    });

    // Encoders: the knob, its field on screen, its mirror in the bar.
    this.root.querySelectorAll<HTMLElement>('.enc').forEach((el, i) => {
      const f = $<HTMLButtonElement>(`[data-ef="${i}"]`);
      const m = $(`[data-mini="${i}"]`);
      const enc: Enc = {
        root: el,
        knob: el.querySelector('.knob')!,
        led: el.querySelector('.enc-led')!,
        field: f,
        name: f.querySelector('.ef-name')!,
        val: f.querySelector('.ef-val')!,
        mini: { root: m, name: m.querySelector('.ef-name')!, val: m.querySelector('.ef-val')! },
        attr: null,
        rot: 0,
      };
      this.encs.push(enc);
      this.wireKnob(enc);
      m.addEventListener('click', () => this.setOpen(true));
      // Tapping an encoder's field asks for a value on the command line, the
      // way a tap opens the calculator on the desk.
      f.addEventListener('click', () => {
        if (!enc.attr) return;
        this.cmd.value = `Attribute "${ATTRS[enc.attr].name}" At `;
        this.cmd.focus();
      });
    });

    // Faders.
    this.root.querySelectorAll<HTMLElement>('.exec').forEach((el) => {
      const id = el.dataset.exec as Fader['id'];
      const input = el.querySelector('input')!;
      const f: Fader = {
        id,
        input,
        lcd: el.querySelector('.exec-lcd .lcd-val')!,
        bar: el.querySelector('.xl-bar i'),
        shown: this.faderTarget(id),
        dragging: false,
      };
      input.value = String(Math.round(f.shown * 100));
      input.addEventListener('pointerdown', () => (f.dragging = true));
      const up = () => (f.dragging = false);
      input.addEventListener('pointerup', up);
      input.addEventListener('pointercancel', up);
      input.addEventListener('blur', up);
      input.addEventListener('input', () => {
        const v = Number(input.value) / 100;
        f.shown = v;
        this.desk.setExec(Number(id.slice(1)), v);
      });
      this.faders.push(f);
    });
    this.wireScreenGM();

    // Keys and buttons.
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      // A fixture's number in the sheet selects it like its name.
      const fid = t.closest<HTMLElement>('.fs-fid');
      if (fid && fid.tagName === 'TD') return this.toggleFixture(Number(fid.parentElement!.dataset.row), (e as MouseEvent).shiftKey);
      const b = t.closest<HTMLButtonElement>('button');
      if (!b || !this.root.contains(b)) return;
      const d = b.dataset;
      if (d.act === 'go') this.say({ ok: true, msg: this.desk.go() }, 'Go+');
      else if (d.act === 'goback') this.say({ ok: true, msg: this.desk.goBack() }, 'Go-');
      else if (d.act === 'pause') this.say({ ok: true, msg: this.desk.pause() }, 'Pause');
      else if (d.act === 'please') this.run(this.cmd.value);
      else if (d.off) this.say({ ok: true, msg: this.desk.off(Number(d.off)) }, `Off Executor ${d.off}`);
      else if (d.kp) this.type(d.kp === '+' || d.kp === '-' ? ` ${d.kp} ` : d.kp);
      else if (d.pk && PROG_KEYS[Number(d.pk)].label !== 'Clear') this.progKey(PROG_KEYS[Number(d.pk)].act);
      else if (d.feature) this.setFeature(d.feature as Feature);
      else if (d.fixture) this.toggleFixture(Number(d.fixture), (e as MouseEvent).shiftKey);
      else if (d.preset) {
        const [ty, n] = d.preset.split('.').map(Number);
        this.say({ ok: true, msg: this.desk.applyPreset(ty, n) }, `Preset ${ty}.${n}`);
      } else if (d.cue) this.say({ ok: true, msg: this.desk.gotoCue(Number(d.cue)) }, `Goto Cue ${d.cue}`);
      else if (d.progonly != null) {
        this.progOnly = !this.progOnly;
        this.render();
      }
      else if (b.classList.contains('ep')) {
        // The encoder page button steps through the feature groups.
        const i = FEATURES.indexOf(this.desk.feature);
        this.setFeature(FEATURES[(i + 1) % FEATURES.length]);
      }
    });

    // Clear: tap for the next stage, hold for a full clear.
    const clearKey = $<HTMLButtonElement>(`[data-pk="${PROG_KEYS.findIndex((k) => k.label === 'Clear')}"]`);
    let holdT = 0;
    let held = false;
    clearKey.addEventListener('pointerdown', () => {
      held = false;
      clearTimeout(holdT);
      holdT = window.setTimeout(() => {
        held = true;
        this.say({ ok: true, msg: this.desk.clearAll() }, 'ClearAll');
      }, 1000);
    });
    const release = () => clearTimeout(holdT);
    clearKey.addEventListener('pointerleave', release);
    clearKey.addEventListener('pointercancel', release);
    clearKey.addEventListener('click', () => {
      release();
      if (held) return;
      // With something typed, Clear empties the command line first.
      if (this.cmd.value.trim()) this.cmd.value = '';
      else this.say({ ok: true, msg: this.desk.clear() }, 'Clear');
    });

    // Flash keys are momentary.
    this.root.querySelectorAll<HTMLButtonElement>('[data-flash]').forEach((b) => {
      const n = Number(b.dataset.flash) as 2 | 3 | 4;
      const on = (v: boolean) => {
        if (this.desk.exec[n].flash === v) return;
        this.desk.exec[n].flash = v;
        this.desk.emit();
      };
      b.addEventListener('pointerdown', () => on(true));
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
      b.addEventListener('pointerleave', () => on(false));
      b.addEventListener('blur', () => on(false));
      b.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && on(true));
      b.addEventListener('keyup', () => on(false));
    });

    // The Dynamic pool fills its window with objects, stored or empty.
    const grid = $('.pool-grid');
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        const n = this.poolCapacity(grid);
        const cols = this.poolCols(grid);
        if (n && (n !== this.poolSlots || cols !== this.poolColCount)) {
          this.poolSlots = n;
          this.poolColCount = cols;
          this.renderPool();
        }
      }).observe(grid);
    }
    // Executor 1's label lists its cues on a grandMA3.
    const c1 = this.root.querySelector<HTMLElement>('.xl-c1'), c2 = this.root.querySelector<HTMLElement>('.xl-c2');
    if (c1 && c2) this.xlCues = [c1, c2];

    // Typing anywhere while the desk is open goes to the command line, like a desk keyboard.
    addEventListener('keydown', (e) => {
      if (!this.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      // A show's photos are open over the desk: typing belongs to them.
      if (document.documentElement.classList.contains('sheet-open')) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [role="slider"]')) return;
      if (/^[a-z0-9.+"]$/i.test(e.key)) this.cmd.focus();
    });
  }

  private poolCapacity(grid: HTMLElement) {
    const cs = getComputedStyle(grid);
    if (cs.display === 'none' || !grid.clientHeight) return 0;
    const cols = cs.gridTemplateColumns.split(' ').filter((s) => /px$/.test(s)).length;
    const rowH = parseFloat(cs.gridAutoRows) || 60;
    const gap = parseFloat(cs.rowGap) || 0;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const rows = Math.max(1, Math.floor((grid.clientHeight - pad + gap) / (rowH + gap)));
    return cols ? cols * rows : 0;
  }

  private wireKnob(enc: Enc) {
    const k = enc.knob;
    let lastY = 0, lastX = 0, acc = 0, moved = false, first = true, startX = 0, startY = 0;
    let wheelAcc = 0;
    const turn = (detents: number, record: boolean) => {
      if (!enc.attr) return;
      const msg = this.desk.nudge(enc.attr, detents, record);
      enc.rot += detents * 9;
      k.style.setProperty('--rot', `${enc.rot}deg`);
      if (/selected|not on/.test(msg)) this.say({ ok: !/not on/.test(msg), msg });
    };
    k.addEventListener('pointerdown', (e) => {
      if (!enc.attr) return;
      k.setPointerCapture(e.pointerId);
      lastY = startY = e.clientY;
      lastX = startX = e.clientX;
      acc = 0;
      moved = false;
      first = true;
      k.classList.add('is-turning');
    });
    k.addEventListener('pointermove', (e) => {
      if (!k.hasPointerCapture(e.pointerId) || !enc.attr) return;
      const px = ATTRS[enc.attr].options ? 22 : 6;
      acc += (lastY - e.clientY + (e.clientX - lastX) * 0.6) / px;
      lastY = e.clientY;
      lastX = e.clientX;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 3) moved = true;
      while (Math.abs(acc) >= 1) {
        const s = Math.sign(acc);
        turn(s, first);
        first = false;
        acc -= s;
      }
    });
    const end = (e: PointerEvent) => {
      if (!k.hasPointerCapture(e.pointerId)) return;
      k.releasePointerCapture(e.pointerId);
      k.classList.remove('is-turning');
      if (!moved && enc.attr && e.type === 'pointerup') {
        // A press on the encoder toggles fine resolution.
        this.desk.fine = !this.desk.fine;
        this.desk.emit();
      }
    };
    k.addEventListener('pointerup', end);
    k.addEventListener('pointercancel', end);
    k.addEventListener(
      'wheel',
      (e) => {
        if (!enc.attr) return;
        // A sideways trackpad swipe isn't a turn.
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        // Trackpads send many small deltas, mouse wheels one big one per notch:
        // gather them up so either gives one detent per notch's worth.
        wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
        if (Math.abs(wheelAcc) >= 48) {
          turn(wheelAcc < 0 ? 1 : -1, true);
          wheelAcc = 0;
        }
      },
      { passive: false },
    );
    k.addEventListener('keydown', (e) => {
      const map: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
      if (!(e.key in map) || !enc.attr) return;
      e.preventDefault();
      turn(map[e.key], true);
    });
  }

  /** The Grand Master on screen: drag up or down anywhere on it, like a touch fader. */
  private wireScreenGM() {
    const el = this.gmEl;
    let startY = 0, startV = 0, wheelAcc = 0;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      startY = e.clientY;
      startV = this.desk.gm;
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      // A full throw is 160 px whatever size the fader is drawn.
      this.setGM(startV + (startY - e.clientY) / 160);
    });
    const end = (e: PointerEvent) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        wheelAcc += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
        if (Math.abs(wheelAcc) >= 24) {
          this.setGM(this.desk.gm + (wheelAcc < 0 ? 0.02 : -0.02));
          wheelAcc = 0;
        }
      },
      { passive: false },
    );
    el.addEventListener('keydown', (e) => {
      const map: Record<string, number> = { ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01, PageUp: 0.1, PageDown: -0.1, Home: -1, End: 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      this.setGM(this.desk.gm + map[e.key]);
    });
  }

  private setGM(v: number) {
    const g = Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
    if (g === this.desk.gm) return;
    this.desk.gm = g;
    this.desk.emit();
  }

  private setFeature(f: Feature) {
    if (this.desk.feature === f) return;
    this.desk.feature = f;
    this.desk.emit();
  }

  /**
   * A tap in the fixture sheet adds the fixture to the selection or takes it
   * out, so a touch screen can pick any combination. Shift with a mouse does
   * the same; a plain click picks just that fixture.
   */
  private toggleFixture(id: number, add = false) {
    const d = this.desk;
    const touchLike = matchMedia('(pointer: coarse)').matches;
    let next: number[];
    if (touchLike || add) {
      const s = new Set(d.selection);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      next = [...s];
    } else next = d.selection.size === 1 && d.selection.has(id) ? [] : [id];
    if (!next.length) this.say({ ok: true, msg: d.clearSelection() }, 'ClearSelection');
    else this.say({ ok: true, msg: d.select(next) }, `Fixture ${listName(next)}`);
  }

  /** grandMA3 numbers the fader executors from 201; messages and echoes use those numbers. */
  private execNames(msg: string) {
    return msg.replace(/\bExecutor ([1-4])\b/g, 'Executor 20$1');
  }

  /* ------------------------------------------------------ command line */

  private cmdKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.run(this.cmd.value);
    } else if (e.key === 'Escape') {
      this.cmd.value = '';
    } else if (e.key === 'ArrowUp' && this.history.length) {
      e.preventDefault();
      this.hIdx = Math.min(this.history.length - 1, this.hIdx + 1);
      this.cmd.value = this.history[this.history.length - 1 - this.hIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.hIdx = Math.max(-1, this.hIdx - 1);
      this.cmd.value = this.hIdx < 0 ? '' : this.history[this.history.length - 1 - this.hIdx];
    }
  }

  private run(text: string) {
    const t = text.trim();
    if (!t) return;
    const r = execute(this.desk, t);
    this.history.push(t);
    if (this.history.length > 200) this.history.shift();
    this.hIdx = -1;
    this.cmd.value = '';
    this.say(r, echo(t));
  }

  private type(s: string) {
    let v = this.cmd.value;
    if (/^[A-Za-z ]/.test(s) && s.trim() && v && !v.endsWith(' ') && !s.startsWith(' ')) v += ' ';
    v = (v + s).replace(/\s{2,}/g, ' ');
    this.cmd.value = v.replace(/^\s+/, '');
  }

  private progKey(a: KeyAction) {
    if (a.kind === 'type') return this.type(a.text);
    switch (a.act) {
      case 'full':
        if (!this.cmd.value.trim()) this.run('At Full');
        else this.run(`${this.cmd.value} At Full`);
        break;
      case 'highlight':
        this.say({ ok: true, msg: this.desk.toggleHighlight() }, 'Highlight');
        break;
      case 'blind':
        this.say({ ok: true, msg: this.desk.toggleBlind() }, 'Blind');
        break;
      case 'oops':
        if (this.cmd.value.trim()) {
          // Oops on the command line removes the last thing typed.
          this.cmd.value = this.cmd.value.trim().replace(/\s*\S+$/, '');
        } else this.say({ ok: true, msg: this.desk.oops() }, 'Oops');
        break;
      case 'esc':
        this.cmd.value = '';
        break;
      case 'help':
        this.run('Help');
        break;
      case 'please':
        this.run(this.cmd.value);
        break;
    }
  }

  /**
   * The line under the command line works like the last line of the command
   * line history: what was executed, in desk syntax. Errors show their
   * message in red; Help shows its list.
   */
  say(r: Result, executed?: string) {
    if (!r.msg) return;
    const ok = r.ok && !looksLikeError(r.msg);
    const multi = r.msg.includes('\n');
    const sel = r.msg.match(/^Fixture (.+) selected$/);
    const text = !ok || multi ? r.msg : executed || (sel ? `Fixture ${sel[1]}` : r.msg);
    this.fb.textContent = this.execNames(text);
    this.fb.classList.toggle('is-error', !ok);
    this.fb.classList.toggle('is-multi', multi);
    this.fb.classList.toggle('is-echo', ok && !multi && !!(executed || sel));
  }

  /* ------------------------------------------------------------- render */

  setOpen(open: boolean) {
    if (open === this.isOpen) return;
    this.isOpen = open;
    this.handle.setAttribute('aria-expanded', String(open));
    setText(this.handle.querySelector('.handle-label')!, open ? 'Close' : 'Desk');
    document.documentElement.classList.toggle('desk-open', open);
    clearTimeout(this.openT);
    if (open) {
      this.root.classList.remove('is-shut');
      this.screen.hidden = false;
      this.hw.hidden = false;
      this.render();
      this.paintSheet();
      requestAnimationFrame(() => {
        if (!this.isOpen) return;
        this.root.classList.add('is-open');
        this.openT = window.setTimeout(() => this.onOpenChange(true), this.reduced ? 0 : 340);
      });
    } else {
      // Anything focused inside the parts about to hide goes back to the handle.
      if (this.screen.contains(document.activeElement) || this.hw.contains(document.activeElement)) this.handle.focus({ preventScroll: true });
      this.root.classList.remove('is-open');
      const done = () => {
        if (this.isOpen) return;
        this.screen.hidden = true;
        this.hw.hidden = true;
        this.scroller.scrollTop = 0;
        this.root.classList.add('is-shut');
        this.onOpenChange(false);
      };
      if (this.reduced) done();
      else this.openT = window.setTimeout(done, 320);
    }
  }
  private openT = 0;

  private faderTarget(id: Fader['id']) {
    const d = this.desk;
    return id === 'e1' ? d.exec[1].level : id === 'e2' ? d.exec[2].level : id === 'e3' ? d.exec[3].level : d.exec[4].level;
  }

  /** What an encoder shows for an attribute: the first selected fixture that has it. */
  private attrDisplay(attr: AttrKey) {
    const d = this.desk;
    const fx = d.targets(attr)[0] ?? FIXTURES.find((f) => f.attrs.includes(attr))!.id;
    if ((attr === 'pan' || attr === 'tilt') && this.live[fx]) {
      const pp = d.posPreset.get(fx);
      if (!d.blind && pp) {
        const p = PRESETS.find((x) => `${x.type}.${x.n}` === pp.preset);
        return { text: p?.name ?? pp.preset, cls: pp.active ? 'v-prog' : 'v-inact' };
      }
      const pv = d.value(fx, attr);
      if (pv.src === 'programmer' || pv.src === 'inactive') return { text: sheetFmt(attr, pv.v), cls: valueClass(pv.src, pv.v) };
      const pos = d.position(fx);
      return { text: sheetFmt(attr, this.live[fx][attr]), cls: pos.kind === 'follow' ? 'v-def' : 'v-cue' };
    }
    const { v, src } = d.value(fx, attr);
    return { text: sheetFmt(attr, v), cls: valueClass(src, v) };
  }

  /** A fixture sheet cell. */
  private cellDisplay(fx: number, attr: AttrKey) {
    const d = this.desk;
    if ((attr === 'pan' || attr === 'tilt') && SPOTS.includes(fx)) {
      const pp = d.posPreset.get(fx);
      // Values from a preset carry the bright cyan preset marker.
      if (!d.blind && pp) return { text: pp.preset, cls: `${pp.active ? 'v-prog' : 'v-inact'} mk-preset` };
      const pv = d.value(fx, attr);
      if (pv.src === 'programmer' || pv.src === 'inactive') return { text: sheetFmt(attr, pv.v), cls: valueClass(pv.src, pv.v) };
      const pos = d.position(fx);
      return { text: sheetFmt(attr, this.live[fx]?.[attr] ?? pv.v), cls: pos.kind === 'follow' ? 'v-def' : 'v-cue' };
    }
    const { v, src } = d.value(fx, attr);
    return { text: sheetFmt(attr, v), cls: valueClass(src, v) };
  }

  /** The programmer isn't clear: something is selected or holds values. */
  private progLive() {
    return this.desk.selection.size > 0 || this.desk.hasValues();
  }

  /** Feature groups with active programmer values, for the selection (or everything when nothing is selected). */
  private markedFeatures() {
    const d = this.desk;
    const ids = d.selection.size ? [...d.selection] : FIXTURES.map((f) => f.id);
    const s = new Set<Feature>();
    for (const id of ids) {
      for (const [k, v] of d.prog.get(id) ?? []) if (v.active) s.add(ATTRS[k].feature);
      if (d.posPreset.get(id)?.active) s.add('Position');
    }
    return s;
  }

  render() {
    const d = this.desk;
    const r = this.root;
    const live = this.progLive();

    // Feature group control bar: the bar over a group lights when the
    // selection has it, a marker shows active values.
    const avail = d.availableFeatures();
    const marks = this.markedFeatures();
    this.html('.fgcb', FEATURES.map((f) => {
      const cls = ['fg', f === d.feature && 'is-on', d.selection.size && avail.includes(f) && 'is-avail', marks.has(f) && 'has-mark'].filter(Boolean).join(' ');
      return `<button type="button" role="tab" class="${cls}" data-feature="${f}" aria-selected="${f === d.feature}"><i class="fg-bar"></i><span>${f}</span><i class="fg-mark"></i></button>`;
    }).join(''));

    // Encoder page: the feature and how many pages of encoders it has.
    const attrs = d.encoderAttrs();
    const total = new Set((d.selection.size ? [...d.selection] : SPOTS).flatMap((id) => d.fixture(id)!.attrs.filter((a) => ATTRS[a].feature === d.feature))).size;
    setText(r.querySelector('.ep-name')!, d.feature);
    setText(r.querySelector('.ep-count')!, `1/${Math.max(1, Math.ceil(total / 5))}`);

    this.encs.forEach((enc, i) => {
      enc.attr = attrs[i];
      const empty = !enc.attr;
      enc.root.classList.toggle('is-empty', empty);
      enc.field.classList.toggle('is-empty', empty);
      enc.field.disabled = empty;
      enc.mini.root.classList.toggle('is-empty', empty);
      enc.knob.setAttribute('aria-disabled', String(empty));
      enc.knob.tabIndex = empty ? -1 : 0;
      // Bars over the encoder fields, and the lights under the encoders, turn
      // the layer's colour once the programmer is in use.
      const lit = live && !empty;
      enc.field.classList.toggle('is-live', lit);
      enc.mini.root.classList.toggle('is-live', lit);
      enc.led.classList.toggle('on', lit);
    });
    this.paintEncoders();

    // Keys whose legends light when they're on.
    const lit = (name: string, on: boolean) => r.querySelectorAll(`[data-lit="${name}"]`).forEach((el) => el.classList.toggle('is-lit', on));
    lit('hi', d.highlight);
    lit('blind', d.blind);
    lit('clear', d.hasValues());
    lit('go', d.exec[1].cue != null && !d.exec[1].paused);
    lit('pause', d.exec[1].paused);
    lit('f2', d.exec[2].flash);
    lit('f3', d.exec[3].flash);
    lit('f4', d.exec[4].flash);
    document.documentElement.classList.toggle('is-blind', d.blind);

    this.renderPool();

    // Sequence sheet. The active cue has a green frame; fades run as moving bars.
    const cur = d.exec[1].cue;
    this.html('.cue-table tbody', d.cues
      .map(
        (c) => `<tr class="${c.n === cur ? `is-cur${d.exec[1].paused ? ' is-paused' : ''}` : ''}" data-cue="${c.n}">
          <td class="cs-no">${c.n}</td><td class="cs-part">0</td><td class="cs-name"><button type="button" data-cue="${c.n}">${esc(c.name)}</button></td><td class="cs-fade"><span class="fade-bar"></span><span class="fade-t">${c.fade}</span></td><td class="cs-delay">0</td></tr>`,
      )
      .join(''));
    if (cur !== this.lastCue) {
      const first = this.lastCue === undefined;
      this.lastCue = cur;
      const c = d.currentCue();
      this.fade = { cue: cur, t: 0, dur: first || !c ? 0 : c.fade, bar: r.querySelector<HTMLElement>('.cue-table tr.is-cur .fade-bar') };
      this.scrollCueIntoView();
    } else if (this.fade.bar && !this.fade.bar.isConnected) {
      this.fade.bar = r.querySelector<HTMLElement>('.cue-table tr.is-cur .fade-bar');
    }

    // The fixture sheet's names: selected fixtures read yellow on gray.
    // Prog Only shows just the fixtures with values in the programmer.
    for (const row of this.rows) {
      const sel = d.selection.has(row.id);
      if (row.tr.classList.contains('is-sel') !== sel) row.tr.classList.toggle('is-sel', sel);
      setAttr(row.btn, 'aria-pressed', String(sel));
      const hide = this.progOnly && !(d.prog.get(row.id)?.size || d.posPreset.has(row.id));
      if (row.tr.hidden !== hide) row.tr.hidden = hide;
    }
    const po = r.querySelector<HTMLElement>('[data-progonly]')!;
    setAttr(po, 'aria-pressed', String(this.progOnly));
    r.classList.toggle('is-fine', d.fine);
    if (this.isOpen) this.paintSheet();

    // Grand Master: the title bar is green while it's enabled.
    setClass(this.gmEl, `sgm${d.blackout ? ' is-black' : ''}`);
  }

  private renderPool() {
    const d = this.desk;
    const type = POOL_OF[d.feature];
    const list = PRESETS.filter((p) => p.type === type);
    const ids = [...d.selection];
    const maxN = list.reduce((m, p) => Math.max(m, p.n), 0);
    // Fill whole rows: the window shows every slot it has room for.
    const cap = Math.max(this.poolSlots, maxN + 1);
    const cols = this.poolColCount;
    const slots = (cols ? Math.ceil(cap / cols) * cols : cap) - 1;
    const tiles: string[] = [
      `<div class="tile title-cell">${GLYPH}<span class="tc-icon">${POOL_ICON[d.feature]}</span><span class="tc-name">${d.feature}</span><span class="tc-sub">Dynamic</span></div>`,
    ];
    for (let n = 1; n <= slots; n++) {
      const p = list.find((x) => x.n === n);
      if (!p) {
        tiles.push(`<div class="tile is-empty" aria-hidden="true"><span class="tile-num">${n}</span></div>`);
        continue;
      }
      // The bar over an object: green when every selected fixture can use it,
      // yellow when some can; dimmed when none can. The pool colour with no selection.
      const can = ids.filter((id) => this.canUse(p, id)).length;
      const fit = !ids.length ? 'fit-pool' : can === ids.length ? 'fit-all' : can ? 'fit-some' : 'fit-none';
      const used = this.presetUse(p);
      tiles.push(`<button type="button" class="tile ${fit}" data-preset="${p.type}.${p.n}" aria-label="Preset ${p.type}.${p.n} ${esc(p.name)}${used ? `, used by ${used}` : ''}">
        <i class="tile-bar"></i><span class="tile-num">${p.n}</span>${used ? `<span class="tile-count">${used}</span>` : ''}${this.tileArt(p)}<span class="tile-name">${esc(p.name)}</span></button>`);
    }
    this.html('.pool-grid', tiles.join(''));
  }

  private poolCols(g: HTMLElement) {
    return getComputedStyle(g).gridTemplateColumns.split(' ').filter((s) => /px$/.test(s)).length;
  }

  private canUse(p: Preset, id: number) {
    const f = this.desk.fixture(id);
    if (!f) return false;
    if (p.slug) return SPOTS.includes(id);
    return Object.keys(p.values!).some((k) => f.attrs.includes(k as AttrKey));
  }

  /** How many fixtures hold this preset's values in the programmer: the cyan count on the object. */
  private presetUse(p: Preset) {
    const d = this.desk;
    const key = `${p.type}.${p.n}`;
    if (p.slug) return [...d.posPreset.values()].filter((x) => x.preset === key).length;
    let n = 0;
    for (const f of FIXTURES) {
      const keys = Object.keys(p.values!).filter((k) => f.attrs.includes(k as AttrKey)) as AttrKey[];
      if (!keys.length) continue;
      const m = d.prog.get(f.id)!;
      if (keys.every((k) => {
        const pv = m.get(k);
        return pv && Math.abs(pv.v - p.values![k]!) < 0.01;
      })) n++;
    }
    return n;
  }

  private scrollCueIntoView() {
    const box = this.root.querySelector<HTMLElement>('.cue-scroll');
    const row = box?.querySelector<HTMLElement>('tr.is-cur');
    if (!box || !row || !box.clientHeight) return;
    const head = box.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const top = row.offsetTop - head;
    const bottom = row.offsetTop + row.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }

  private lastHtml = new Map<string, string>();
  /**
   * Replace a group of buttons only when its markup changed, and keep keyboard
   * focus on the same button (matched by its data key) when it is rebuilt.
   */
  private html(sel: string, markup: string) {
    if (this.lastHtml.get(sel) === markup) return;
    this.lastHtml.set(sel, markup);
    const el = this.root.querySelector<HTMLElement>(sel)!;
    const a = document.activeElement as HTMLElement | null;
    let key: string | null = null;
    if (a && el.contains(a)) {
      for (const k of ['fixture', 'feature', 'preset', 'cue']) {
        if (a.dataset[k] != null) {
          key = `button[data-${k}="${a.dataset[k]}"]`;
          break;
        }
      }
    }
    el.innerHTML = markup;
    if (key) el.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
  }

  private tileArt(p: Preset) {
    if (p.type === 4) return `<i class="tile-swatch" style="background:${rgbCss(kelvinToRgb(p.values!.cct!))}"></i>`;
    if (p.type === 3) return `<img class="tile-gobo" src="${this.goboIcons[p.values!.gobo!]}" alt="" />`;
    if (p.type === 1) return `<i class="tile-level"><b style="width:${p.values!.dim}%"></b></i>`;
    return '';
  }

  private paintEncoders() {
    for (const enc of this.encs) {
      if (!enc.attr) {
        for (const el of [enc.name, enc.mini.name, enc.val, enc.mini.val]) setText(el, '');
        continue;
      }
      const a = ATTRS[enc.attr];
      const dsp = this.attrDisplay(enc.attr);
      setText(enc.name, a.name);
      setText(enc.mini.name, a.name);
      setText(enc.val, dsp.text);
      setText(enc.mini.val, dsp.text);
      setClass(enc.val, `ef-val ${dsp.cls}`);
      setClass(enc.mini.val, `ef-val ${dsp.cls}`);
      setAttr(enc.knob, 'aria-label', `${a.name} encoder`);
      setAttr(enc.knob, 'aria-valuetext', dsp.text);
      setAttr(enc.field, 'aria-label', `${a.name} ${dsp.text}. Set a value`);
    }
  }

  private paintSheet() {
    for (const c of this.cells) {
      const v = this.cellDisplay(c.fx, c.attr);
      setText(c.el, v.text);
      setClass(c.el, `fs-v ${v.cls}`);
      // Colour temperature carries a swatch of the colour.
      if (c.attr === 'cct') setVar(c.el, '--sw', rgbCss(kelvinToRgb(this.desk.value(c.fx, 'cct').v)));
    }
  }

  private frame = 0;
  /** Per frame: motor faders glide to their levels, readouts follow the heads, fades run. */
  tick(dt: number, live: Live) {
    this.live = live;
    const d = this.desk;
    for (const f of this.faders) {
      const target = this.faderTarget(f.id);
      if (!f.dragging && Math.abs(target - f.shown) > 0.002) {
        f.shown += (target - f.shown) * Math.min(1, dt * (this.reduced ? 60 : 7));
        f.input.value = String(Math.round(f.shown * 100));
      }
      const pctTxt = `${Math.round(target * 100)}%`;
      setText(
        f.lcd,
        f.id === 'e1' ? (d.exec[1].cue == null ? 'Off' : `Cue ${d.exec[1].cue}`) : pctTxt,
      );
      if (f.bar) setVar(f.bar, '--v', target.toFixed(3));
    }

    // The executor label's cue list: the active cue on blue, the next under it.
    if (this.xlCues) {
      const cur = d.currentCue();
      const next = cur ? d.nextCue() : d.cues[0];
      setText(this.xlCues[0], cur ? `${cur.n} ${cur.name}` : '');
      setText(this.xlCues[1], next ? `${next.n} ${next.name}` : '');
    }

    // Grand Master on screen.
    setVar(this.gmEl, '--v', d.gm.toFixed(3));
    setText(this.gmEl.querySelector('.sgm-val')!, d.blackout ? 'Black' : String(Math.round(d.gm * 100)));
    setAttr(this.gmEl, 'aria-valuenow', String(Math.round(d.gm * 100)));

    // A running fade shows as a bar moving through the cue's fade time.
    const fd = this.fade;
    if (fd.bar && fd.dur > 0) {
      if (!d.exec[1].paused) fd.t += dt;
      const p = Math.min(1, fd.t / fd.dur);
      setVar(fd.bar, '--p', p.toFixed(3));
      if (p >= 1) {
        fd.bar.style.removeProperty('--p');
        fd.dur = 0;
      }
    }

    if (++this.frame % 6 === 0) {
      this.paintEncoders();
      if (this.isOpen) this.paintSheet();
    }
  }
}
