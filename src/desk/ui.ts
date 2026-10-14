import {
  ATTRS, FEATURES, FIXTURES, POOL_NAMES, PRESETS,
  type AttrKey, type Desk, type Preset, type Source,
} from './model';
import { execute, type Result } from './commandline';
import { kelvinToRgb, rgbCss } from '../engine/kelvin';

export interface Live {
  pan: number;
  tilt: number;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type KeyAction =
  | { kind: 'type'; text: string }
  | { kind: 'do'; act: 'full' | 'highlight' | 'blind' | 'oops' | 'clear' | 'esc' | 'please' };

const PROG_KEYS: [string, KeyAction, string?][] = [
  ['Fixture', { kind: 'type', text: 'Fixture ' }],
  ['Preset', { kind: 'type', text: 'Preset ' }],
  ['Cue', { kind: 'type', text: 'Cue ' }],
  ['Exec', { kind: 'type', text: 'Executor ' }],
  ['Store', { kind: 'type', text: 'Store ' }],
  ['Goto', { kind: 'type', text: 'Goto ' }],
  ['At', { kind: 'type', text: ' At ' }],
  ['Thru', { kind: 'type', text: ' Thru ' }],
  ['Full', { kind: 'do', act: 'full' }],
  ['Off', { kind: 'type', text: 'Off ' }],
  ['Highlt', { kind: 'do', act: 'highlight' }, 'led-hi'],
  ['Blind', { kind: 'do', act: 'blind' }, 'led-blind'],
  ['Oops', { kind: 'do', act: 'oops' }],
  ['Clear', { kind: 'do', act: 'clear' }, 'led-clear'],
  ['Esc', { kind: 'do', act: 'esc' }],
];

const KEYPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '+'];

const SRC_CLASS: Record<Source, string> = {
  programmer: 'src-prog',
  inactive: 'src-inactive',
  cue: 'src-cue',
  executor: 'src-cue',
  highlight: 'src-hi',
  default: 'src-def',
};

interface Enc {
  root: HTMLElement;
  name: HTMLElement;
  val: HTMLElement;
  bar: HTMLElement;
  knob: HTMLElement;
  mini: { name: HTMLElement; val: HTMLElement; root: HTMLElement };
  attr: AttrKey | null;
  rot: number;
}

interface Fader {
  id: 'e1' | 'e2' | 'e3' | 'gm';
  input: HTMLInputElement;
  lcd: HTMLElement;
  shown: number;
  dragging: boolean;
}

export class DeskUI {
  private root: HTMLElement;
  private desk: Desk;
  private reduced: boolean;
  private cmd!: HTMLInputElement;
  private fb!: HTMLElement;
  private body!: HTMLElement;
  private handle!: HTMLButtonElement;
  private encs: Enc[] = [];
  private faders: Fader[] = [];
  private poolType = 2;
  private history: string[] = [];
  private hIdx = -1;
  private live: Live = { pan: 0, tilt: 30 };
  private goboIcons: string[];
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
    const mini = [0, 1, 2, 3, 4].map((i) => `<button class="mini-lcd" type="button" data-mini="${i}"><span class="lcd-name"></span><span class="lcd-val"></span></button>`).join('');
    const encs = [0, 1, 2, 3, 4]
      .map(
        (i) => `<div class="enc" data-enc="${i}">
          <div class="lcd"><span class="lcd-name"></span><span class="lcd-val"></span><span class="lcd-bar"><i></i></span></div>
          <div class="knob" role="slider" tabindex="0" aria-label="Encoder ${i + 1}"><span class="knob-cap"></span></div>
        </div>`,
      )
      .join('');
    const fader = (id: string, label: string, keys: string) => `
      <div class="exec" data-exec="${id}">
        <div class="exec-keys">${keys}</div>
        <div class="exec-lcd lcd" aria-hidden="true"><span class="lcd-name">${label}</span><span class="lcd-val"></span></div>
        <div class="fader">
          <span class="fader-scale" aria-hidden="true"><i>Full</i><i></i><i></i><i></i><i>50</i><i></i><i></i><i></i><i>0</i></span>
          <input type="range" min="0" max="100" step="1" aria-label="${label} fader" />
        </div>
        <span class="exec-num">${id === 'gm' ? 'GM' : `Exec ${id.slice(1)}`}</span>
      </div>`;
    const key = (label: string, attrs: string, led?: string) => {
      // Fold any extra classes into the one class attribute.
      const extra = attrs.match(/class="([^"]*)"/)?.[1] ?? '';
      const rest = attrs.replace(/class="[^"]*"\s*/, '');
      const cls = ['key', ...extra.split(/\s+/).filter((c) => c && c !== 'key')].join(' ');
      return `<button class="${cls}" type="button" ${rest}>${led ? `<i class="led ${led}"></i>` : ''}<span>${label}</span></button>`;
    };

    this.root.innerHTML = `
      <div class="desk-bar">
        <div class="cmd">
          <label class="cmd-prompt" for="cmd-input">[Fixture]&gt;</label>
          <input id="cmd-input" class="cmd-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Fixture 1 At 50" />
          <p class="cmd-fb" aria-live="polite"></p>
        </div>
        <div class="bar-lcds">${mini}</div>
        <div class="bar-go">
          ${key('Go-', 'data-act="goback" aria-label="Go back one cue"')}
          ${key('Go', 'class="key key-go" data-act="go" aria-label="Go to next cue"', 'led-go')}
        </div>
        <button class="desk-handle" type="button" aria-expanded="false" aria-controls="desk-body">
          <span class="grip" aria-hidden="true"></span><span class="handle-label">Desk</span>
        </button>
      </div>
      <div class="desk-body" id="desk-body" hidden>
        <div class="screen">
          <div class="windows">
            <section class="win pools" aria-label="Preset pools">
              <header class="win-title"><span>Presets</span><div class="pool-tabs" role="tablist"></div></header>
              <div class="pool-grid"></div>
            </section>
            <section class="win cues" aria-label="Sequence 1 cue list">
              <header class="win-title"><span>Sequence 1</span><span class="seq-state"></span></header>
              <div class="cue-scroll"><table class="cue-table"><thead><tr><th></th><th>Cue</th><th>Name</th><th>Fade</th></tr></thead><tbody></tbody></table></div>
            </section>
          </div>
        </div>
        <div class="hw">
          <div class="enc-bank">
            <div class="fg-bar">
              <div class="fixtures" role="group" aria-label="Fixtures"></div>
              <button class="res" type="button" aria-label="Encoder resolution"></button>
              <div class="fgroups" role="tablist" aria-label="Feature groups"></div>
            </div>
            <div class="encoders">${encs}</div>
          </div>
          <div class="execs">
            ${fader('e1', 'Shows', key('Go-', 'data-act="goback"') + key('Go+', 'data-act="go"', 'led-go'))}
            ${fader('e2', 'Hazer', key('Flash', 'data-flash="2"', 'led-f2') + key('Off', 'data-off="2"'))}
            ${fader('e3', 'Sweep', key('Flash', 'data-flash="3"', 'led-f3') + key('Off', 'data-off="3"'))}
            <div class="gm-col">
              ${fader('gm', 'Grand', '')}
              ${key('B.O.', 'class="key key-bo" data-act="bo" aria-label="Blackout"', 'led-bo')}
            </div>
          </div>
          <div class="keys">
            <div class="prog-keys">${PROG_KEYS.map(([l, , led], i) => key(l, `data-pk="${i}"`, led)).join('')}</div>
            <div class="keypad">${KEYPAD.map((k) => key(k, `data-kp="${k}"`)).join('')}${key('Please', 'class="key key-please" data-act="please"')}</div>
          </div>
          <div class="master">
            ${key('Pause', 'data-act="pause"', 'led-pause')}
            ${key('Go-', 'data-act="goback"')}
            ${key('Go', 'class="key key-go key-big" data-act="go"', 'led-go')}
          </div>
        </div>
      </div>`;

    this.cmd = this.root.querySelector('.cmd-input')!;
    this.fb = this.root.querySelector('.cmd-fb')!;
    this.body = this.root.querySelector('.desk-body')!;
    this.handle = this.root.querySelector('.desk-handle')!;

    this.handle.addEventListener('click', () => this.setOpen(!this.isOpen));
    this.cmd.addEventListener('keydown', (e) => this.cmdKey(e));

    // Encoders and their mirrors in the bar.
    this.root.querySelectorAll<HTMLElement>('.enc').forEach((el, i) => {
      const m = this.root.querySelector<HTMLElement>(`[data-mini="${i}"]`)!;
      const enc: Enc = {
        root: el,
        name: el.querySelector('.lcd-name')!,
        val: el.querySelector('.lcd-val')!,
        bar: el.querySelector('.lcd-bar i')!,
        knob: el.querySelector('.knob')!,
        mini: { root: m, name: m.querySelector('.lcd-name')!, val: m.querySelector('.lcd-val')! },
        attr: null,
        rot: 0,
      };
      this.encs.push(enc);
      this.wireKnob(enc);
      m.addEventListener('click', () => this.setOpen(true));
    });

    // Faders.
    this.root.querySelectorAll<HTMLElement>('.exec').forEach((el) => {
      const id = el.dataset.exec as Fader['id'];
      const input = el.querySelector('input')!;
      const f: Fader = { id, input, lcd: el.querySelector('.exec-lcd .lcd-val')!, shown: this.faderTarget(id), dragging: false };
      input.value = String(Math.round(f.shown * 100));
      input.addEventListener('pointerdown', () => (f.dragging = true));
      const up = () => (f.dragging = false);
      input.addEventListener('pointerup', up);
      input.addEventListener('pointercancel', up);
      input.addEventListener('blur', up);
      input.addEventListener('input', () => {
        const v = Number(input.value) / 100;
        f.shown = v;
        if (id === 'gm') {
          this.desk.gm = v;
          this.desk.emit();
        } else this.desk.setExec(Number(id.slice(1)), v);
      });
      this.faders.push(f);
    });

    // Keys.
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || !this.root.contains(b)) return;
      const d = b.dataset;
      if (d.act === 'go') this.say({ ok: true, msg: this.desk.go() });
      else if (d.act === 'goback') this.say({ ok: true, msg: this.desk.goBack() });
      else if (d.act === 'pause') this.say({ ok: true, msg: this.desk.pause() });
      else if (d.act === 'bo') this.say({ ok: true, msg: this.desk.toggleBlackout() });
      else if (d.act === 'please') this.run(this.cmd.value);
      else if (d.off) this.say({ ok: true, msg: this.desk.off(Number(d.off)) });
      else if (d.kp) this.type(d.kp === '+' ? ' + ' : d.kp);
      else if (d.pk && PROG_KEYS[Number(d.pk)][0] !== 'Clear') this.progKey(PROG_KEYS[Number(d.pk)][1]);
      else if (d.feature) {
        this.desk.feature = d.feature as never;
        this.desk.emit();
      } else if (d.fixture) {
        const id = Number(d.fixture);
        const sel = (e as MouseEvent).shiftKey ? [...this.desk.selection, id] : [id];
        this.say({ ok: true, msg: this.desk.select([...new Set(sel)]) });
      } else if (d.pool) {
        this.poolType = Number(d.pool);
        this.render();
      } else if (d.preset) {
        const [t, n] = d.preset.split('.').map(Number);
        this.say({ ok: true, msg: this.desk.applyPreset(t, n) });
      } else if (d.cue) this.say({ ok: true, msg: this.desk.gotoCue(Number(d.cue)) });
      else if (b.classList.contains('res')) {
        this.desk.fine = !this.desk.fine;
        this.desk.emit();
      }
    });

    // Clear: tap for the next stage, hold for a full clear.
    const clearKey = this.root.querySelector<HTMLButtonElement>(`[data-pk="${PROG_KEYS.findIndex((k) => k[0] === 'Clear')}"]`)!;
    let holdT = 0;
    let held = false;
    clearKey.addEventListener('pointerdown', () => {
      held = false;
      holdT = window.setTimeout(() => {
        held = true;
        this.say({ ok: true, msg: this.desk.clearAll() });
      }, 1000);
    });
    const release = () => clearTimeout(holdT);
    clearKey.addEventListener('pointerleave', release);
    clearKey.addEventListener('click', () => {
      release();
      if (held) return;
      if (this.cmd.value.trim()) {
        this.cmd.value = '';
        this.say({ ok: true, msg: 'Command line cleared' });
      } else this.say({ ok: true, msg: this.desk.clear() });
    });

    // Flash keys are momentary.
    this.root.querySelectorAll<HTMLButtonElement>('[data-flash]').forEach((b) => {
      const n = Number(b.dataset.flash) as 2 | 3;
      const on = (v: boolean) => {
        this.desk.exec[n].flash = v;
        this.desk.emit();
      };
      b.addEventListener('pointerdown', () => on(true));
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointerleave', () => this.desk.exec[n].flash && on(false));
      b.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && on(true));
      b.addEventListener('keyup', () => on(false));
    });

    // Typing anywhere while the desk is open goes to the command line, like a desk keyboard.
    addEventListener('keydown', (e) => {
      if (!this.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [role="slider"]')) return;
      if (/^[a-z0-9.+"]$/i.test(e.key)) {
        this.cmd.focus();
      }
    });
  }

  private wireKnob(enc: Enc) {
    const k = enc.knob;
    let lastY = 0, lastX = 0, acc = 0, moved = false, first = true, startX = 0, startY = 0;
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
      if (!moved && enc.attr) {
        // A press on the encoder toggles fine resolution.
        this.desk.fine = !this.desk.fine;
        this.desk.emit();
        this.say({ ok: true, msg: `Encoder resolution: ${this.desk.fine ? 'Fine' : 'Coarse'}` });
      }
    };
    k.addEventListener('pointerup', end);
    k.addEventListener('pointercancel', end);
    k.addEventListener(
      'wheel',
      (e) => {
        if (!enc.attr) return;
        e.preventDefault();
        turn(e.deltaY < 0 ? 1 : -1, true);
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
    this.hIdx = -1;
    this.cmd.value = '';
    this.say(r, t);
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
        this.say({ ok: true, msg: this.desk.toggleHighlight() });
        break;
      case 'blind':
        this.say({ ok: true, msg: this.desk.toggleBlind() });
        break;
      case 'oops':
        if (this.cmd.value.trim()) {
          // Oops on the command line removes the last thing typed.
          this.cmd.value = this.cmd.value.trim().replace(/\s*\S+$/, '');
        } else this.say({ ok: true, msg: this.desk.oops() });
        break;
      case 'esc':
        this.cmd.value = '';
        break;
      case 'please':
        this.run(this.cmd.value);
        break;
    }
  }

  say(r: Result, input?: string) {
    if (!r.msg) return;
    this.fb.textContent = r.msg;
    this.fb.title = input ?? '';
    this.fb.classList.toggle('is-error', !r.ok);
    this.fb.classList.toggle('is-multi', r.msg.includes('\n'));
  }

  /* ------------------------------------------------------------- render */

  setOpen(open: boolean) {
    this.isOpen = open;
    this.handle.setAttribute('aria-expanded', String(open));
    this.handle.querySelector('.handle-label')!.textContent = open ? 'Close' : 'Desk';
    document.documentElement.classList.toggle('desk-open', open);
    if (open) {
      this.body.hidden = false;
      requestAnimationFrame(() => {
        this.root.classList.add('is-open');
        setTimeout(() => this.onOpenChange(true), this.reduced ? 0 : 340);
      });
    } else {
      this.root.classList.remove('is-open');
      const done = () => {
        if (!this.isOpen) this.body.hidden = true;
        this.onOpenChange(false);
      };
      if (this.reduced) done();
      else setTimeout(done, 320);
    }
  }

  private faderTarget(id: Fader['id']) {
    const d = this.desk;
    return id === 'gm' ? d.gm : id === 'e1' ? d.exec[1].level : id === 'e2' ? d.exec[2].level : d.exec[3].level;
  }

  private attrDisplay(attr: AttrKey) {
    const d = this.desk;
    const fx = d.targets(attr)[0] ?? FIXTURES.find((f) => f.attrs.includes(attr))!.id;
    if ((attr === 'pan' || attr === 'tilt') && fx === 1) {
      const pl = d.positionLabel();
      if (pl) return { text: pl.text, src: pl.src, frac: 0.5 };
      const pv = d.value(1, attr);
      if (pv.src === 'programmer' || pv.src === 'inactive') return this.fmt(attr, pv.v, pv.src);
      const pos = d.position();
      return this.fmt(attr, this.live[attr], pos.kind === 'follow' ? 'default' : 'cue');
    }
    const { v, src } = d.value(fx, attr);
    return this.fmt(attr, v, src);
  }

  private fmt(attr: AttrKey, v: number, src: Source) {
    const a = ATTRS[attr];
    return { text: a.fmt(v), src, frac: (v - a.min) / (a.max - a.min) };
  }

  render() {
    const d = this.desk;
    const r = this.root;

    // Fixtures (selected ones read yellow, as on the desk).
    r.querySelector('.fixtures')!.innerHTML = FIXTURES.map(
      (f) => `<button type="button" class="fx ${d.selection.has(f.id) ? 'is-sel' : ''}" data-fixture="${f.id}" aria-pressed="${d.selection.has(f.id)}"><b>${f.id}</b> ${f.name}</button>`,
    ).join('');

    // Feature groups.
    const avail = d.availableFeatures();
    r.querySelector('.fgroups')!.innerHTML = FEATURES.map(
      (f) => `<button type="button" role="tab" class="fg ${f === d.feature ? 'is-on' : ''}" data-feature="${f}" aria-selected="${f === d.feature}" ${avail.includes(f) ? '' : 'disabled'}>${f}</button>`,
    ).join('');
    const res = r.querySelector<HTMLButtonElement>('.res')!;
    res.textContent = d.fine ? 'Fine' : 'Coarse';
    res.classList.toggle('is-on', d.fine);

    // Encoders.
    const attrs = d.encoderAttrs();
    this.encs.forEach((enc, i) => {
      enc.attr = attrs[i];
      enc.root.classList.toggle('is-empty', !enc.attr);
      enc.mini.root.classList.toggle('is-empty', !enc.attr);
      enc.knob.setAttribute('aria-disabled', String(!enc.attr));
      enc.knob.tabIndex = enc.attr ? 0 : -1;
    });
    this.paintEncoders();

    // LEDs and toggles.
    const led = (cls: string, on: boolean) => r.querySelectorAll(`.${cls}`).forEach((el) => el.classList.toggle('on', on));
    led('led-hi', d.highlight);
    led('led-blind', d.blind);
    led('led-clear', d.hasValues());
    led('led-bo', d.blackout);
    led('led-go', d.exec[1].cue != null && !d.exec[1].paused);
    led('led-pause', d.exec[1].paused);
    led('led-f2', d.exec[2].flash);
    led('led-f3', d.exec[3].flash);
    document.documentElement.classList.toggle('is-blind', d.blind);

    // Pools.
    r.querySelector('.pool-tabs')!.innerHTML = Object.entries(POOL_NAMES)
      .map(([n, name]) => `<button type="button" role="tab" class="pt ${Number(n) === this.poolType ? 'is-on' : ''}" data-pool="${n}" aria-selected="${Number(n) === this.poolType}">${n} ${name}</button>`)
      .join('');
    r.querySelector('.pool-grid')!.innerHTML = PRESETS.filter((p) => p.type === this.poolType)
      .map((p) => {
        const on = this.presetActive(p);
        return `<button type="button" class="tile ${on ? 'is-on' : ''}" data-preset="${p.type}.${p.n}" aria-pressed="${on}">
          <span class="tile-num">${p.type}.${p.n}</span>${this.tileArt(p)}<span class="tile-name">${esc(p.name)}</span></button>`;
      })
      .join('');

    // Cue list.
    const cur = d.exec[1].cue;
    const next = cur == null ? d.cues[0]?.n : d.nextCue().n;
    r.querySelector('.cue-table tbody')!.innerHTML = d.cues
      .map(
        (c) => `<tr class="${c.n === cur ? 'is-cur' : ''} ${c.n === next && c.n !== cur ? 'is-next' : ''}" data-cue="${c.n}">
          <td class="cue-mark">${c.n === cur ? (d.exec[1].paused ? '‖' : '▶') : ''}</td><td>${c.n}</td><td><button type="button" data-cue="${c.n}">${esc(c.name)}</button></td><td>${c.fade}</td></tr>`,
      )
      .join('');
    r.querySelector('.seq-state')!.textContent = cur == null ? 'Off' : `Cue ${cur}${d.exec[1].paused ? ', paused' : ''}`;
  }

  private presetActive(p: Preset) {
    const d = this.desk;
    if (p.slug) return d.posPreset?.preset === `${p.type}.${p.n}` && d.posPreset.active;
    const m = d.prog.get(1)!;
    return Object.entries(p.values!).every(([k, v]) => {
      const pv = m.get(k as AttrKey);
      return pv?.active && Math.abs(pv.v - v) < 0.01;
    });
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
        enc.name.textContent = enc.mini.name.textContent = '';
        enc.val.textContent = enc.mini.val.textContent = '';
        enc.bar.style.width = '0';
        continue;
      }
      const a = ATTRS[enc.attr];
      const dsp = this.attrDisplay(enc.attr);
      const cls = SRC_CLASS[dsp.src];
      enc.name.textContent = enc.mini.name.textContent = a.name;
      enc.val.textContent = enc.mini.val.textContent = dsp.text;
      enc.val.className = `lcd-val ${cls}`;
      enc.mini.val.className = `lcd-val ${cls}`;
      enc.bar.style.width = `${Math.max(0, Math.min(1, dsp.frac)) * 100}%`;
      enc.knob.setAttribute('aria-label', `${a.name} encoder`);
      enc.knob.setAttribute('aria-valuetext', dsp.text);
    }
  }

  private frame = 0;
  /** Per-frame: motor faders glide to their levels, Pan and Tilt readouts follow the head. */
  tick(dt: number, live: Live) {
    this.live = live;
    for (const f of this.faders) {
      const target = this.faderTarget(f.id);
      if (!f.dragging && Math.abs(target - f.shown) > 0.002) {
        f.shown += (target - f.shown) * Math.min(1, dt * (this.reduced ? 60 : 7));
        f.input.value = String(Math.round(f.shown * 100));
      }
      const d = this.desk;
      const pctTxt = `${Math.round(this.faderTarget(f.id) * 100)}%`;
      f.lcd.textContent =
        f.id === 'e1' ? (d.exec[1].cue == null ? `Off ${pctTxt}` : `Q${d.exec[1].cue} ${pctTxt}`)
        : f.id === 'e3' && d.exec[3].auto ? `Auto ${pctTxt}`
        : pctTxt;
    }
    if (++this.frame % 6 === 0) this.paintEncoders();
  }
}
