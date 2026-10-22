import { allShows } from '../data/shows';

/*
  The desk, modelled on how a grandMA3 handles a rig:

  - Fixtures 1 and 2 are spots on moving heads at the wings of the truss.
    Fixtures 3 and 4 are soft LED panels near the centre, hung pointing
    straight down. Fixture 5 is the hazer.
  - Encoders and presets write into the programmer, per fixture. Programmer
    values beat playback and hold until Clear. Clear works in three stages:
    deselect, deactivate, release. Holding Clear releases everything.
  - Sequence 1 on Executor 1 is the show list. Each cue crosses both spots on
    one show. Executor 2 masters the hazer, Executor 3 runs a pan and tilt
    sweep phaser, Executor 4 masters the panels. The Grand Master and B.O.
    sit over everything.
  - With nothing running and nothing programmed, the spots follow the cursor
    (or, on a phone, whatever show is in view).
*/

export type Feature = 'Dimmer' | 'Position' | 'Gobo' | 'Color' | 'Beam' | 'Focus' | 'Control';
export const FEATURES: Feature[] = ['Dimmer', 'Position', 'Gobo', 'Color', 'Beam', 'Focus', 'Control'];

export type AttrKey =
  | 'dim' | 'pan' | 'tilt' | 'gobo' | 'goboRot' | 'cct' | 'shutter' | 'iris'
  | 'zoom' | 'focus' | 'frost' | 'lamp' | 'reset' | 'haze' | 'fan';

export interface AttrDef {
  key: AttrKey;
  name: string;
  feature: Feature;
  min: number;
  max: number;
  /** Change per encoder detent, coarse and fine. */
  step: number;
  fine: number;
  def: number;
  options?: string[];
  fmt: (v: number) => string;
  aliases: string[];
}

const pct = (v: number) => `${Math.round(v)}%`;
export const strobeHz = (v: number) => 0.5 + (v / 100) * 1.5; // capped at 2 Hz, well under flash limits

export const ATTRS: Record<AttrKey, AttrDef> = {
  dim: { key: 'dim', name: 'Dim', feature: 'Dimmer', min: 0, max: 100, step: 2, fine: 0.25, def: 88, fmt: pct, aliases: ['dim', 'dimmer', 'intensity'] },
  pan: { key: 'pan', name: 'Pan', feature: 'Position', min: -60, max: 60, step: 0.8, fine: 0.05, def: 0, fmt: (v) => `${v.toFixed(1)}°`, aliases: ['pan'] },
  tilt: { key: 'tilt', name: 'Tilt', feature: 'Position', min: 0, max: 70, step: 0.8, fine: 0.05, def: 30, fmt: (v) => `${v.toFixed(1)}°`, aliases: ['tilt'] },
  gobo: { key: 'gobo', name: 'Gobo 1', feature: 'Gobo', min: 0, max: 3, step: 1, fine: 1, def: 0, options: ['Open', 'Breakup', 'Dots', 'Ring'], fmt: (v) => ['Open', 'Breakup', 'Dots', 'Ring'][Math.round(v)], aliases: ['gobo', 'gobo1', 'g1'] },
  goboRot: {
    key: 'goboRot', name: 'G1 Rot', feature: 'Gobo', min: -100, max: 100, step: 4, fine: 0.5, def: 20,
    fmt: (v) => (Math.abs(v) < 0.5 ? 'Index' : `${v > 0 ? 'CW' : 'CCW'} ${Math.round(Math.abs(v))}%`),
    aliases: ['gobo1rot', 'g1rot', 'gobo1pos', 'rotation', 'spin', 'gobrot', 'gobo1 rot'],
  },
  cct: { key: 'cct', name: 'Color Temp', feature: 'Color', min: 2700, max: 6500, step: 50, fine: 5, def: 4700, fmt: (v) => `${Math.round(v)} K`, aliases: ['cct', 'cto', 'ctc', 'colortemp', 'color temp', 'colour', 'color', 'kelvin'] },
  shutter: { key: 'shutter', name: 'Shutter', feature: 'Beam', min: 0, max: 100, step: 4, fine: 0.5, def: 0, fmt: (v) => (v < 0.5 ? 'Open' : `Strobe ${strobeHz(v).toFixed(1)} Hz`), aliases: ['shutter', 'strobe', 'shutter1'] },
  iris: { key: 'iris', name: 'Iris', feature: 'Beam', min: 10, max: 100, step: 2, fine: 0.25, def: 100, fmt: pct, aliases: ['iris'] },
  zoom: { key: 'zoom', name: 'Zoom', feature: 'Focus', min: 8, max: 42, step: 0.5, fine: 0.05, def: 19, fmt: (v) => `${v.toFixed(1)}°`, aliases: ['zoom'] },
  focus: { key: 'focus', name: 'Focus', feature: 'Focus', min: 0, max: 100, step: 2, fine: 0.25, def: 70, fmt: pct, aliases: ['focus', 'focus1'] },
  frost: { key: 'frost', name: 'Frost', feature: 'Focus', min: 0, max: 100, step: 2, fine: 0.25, def: 0, fmt: pct, aliases: ['frost', 'frost1'] },
  lamp: { key: 'lamp', name: 'Lamp', feature: 'Control', min: 0, max: 1, step: 1, fine: 1, def: 1, options: ['Off', 'On'], fmt: (v) => (v >= 0.5 ? 'On' : 'Off'), aliases: ['lamp', 'lampcontrol'] },
  reset: { key: 'reset', name: 'Reset', feature: 'Control', min: 0, max: 1, step: 1, fine: 1, def: 0, options: ['Idle', 'Reset'], fmt: (v) => (v >= 0.5 ? 'Reset' : 'Idle'), aliases: ['reset'] },
  haze: { key: 'haze', name: 'Haze', feature: 'Dimmer', min: 0, max: 100, step: 2, fine: 0.25, def: 50, fmt: pct, aliases: ['haze', 'output'] },
  fan: { key: 'fan', name: 'Fan', feature: 'Dimmer', min: 0, max: 100, step: 2, fine: 0.25, def: 40, fmt: pct, aliases: ['fan'] },
};

export type FixtureKind = 'spot' | 'panel' | 'hazer';

export interface FixtureDef {
  id: number;
  name: string;
  kind: FixtureKind;
  attrs: AttrKey[];
}

const SPOT_ATTRS: AttrKey[] = ['dim', 'pan', 'tilt', 'gobo', 'goboRot', 'cct', 'shutter', 'iris', 'zoom', 'focus', 'frost', 'lamp', 'reset'];

export const FIXTURES: FixtureDef[] = [
  { id: 1, name: 'Spot L', kind: 'spot', attrs: SPOT_ATTRS },
  { id: 2, name: 'Spot R', kind: 'spot', attrs: SPOT_ATTRS },
  { id: 3, name: 'Panel L', kind: 'panel', attrs: ['dim', 'cct'] },
  { id: 4, name: 'Panel R', kind: 'panel', attrs: ['dim', 'cct'] },
  { id: 5, name: 'Hazer', kind: 'hazer', attrs: ['haze', 'fan'] },
];
export const SPOTS = [1, 2];
export const PANELS = [3, 4];
export const HAZER = 5;

/* ------------------------------------------------------------- presets */

export interface Preset {
  type: number;
  n: number;
  name: string;
  values?: Partial<Record<AttrKey, number>>;
  slug?: string;
}

export const POOL_NAMES: Record<number, Feature> = { 1: 'Dimmer', 2: 'Position', 3: 'Gobo', 4: 'Color', 5: 'Beam', 6: 'Focus' };

export const PRESETS: Preset[] = [
  { type: 1, n: 1, name: 'Full', values: { dim: 100 } },
  { type: 1, n: 2, name: '75', values: { dim: 75 } },
  { type: 1, n: 3, name: '50', values: { dim: 50 } },
  { type: 1, n: 4, name: '25', values: { dim: 25 } },
  { type: 1, n: 5, name: 'Out', values: { dim: 0 } },
  ...allShows.map((s, i) => ({ type: 2, n: i + 1, name: s.title, slug: s.slug })),
  { type: 3, n: 1, name: 'Open', values: { gobo: 0 } },
  { type: 3, n: 2, name: 'Breakup', values: { gobo: 1 } },
  { type: 3, n: 3, name: 'Dots', values: { gobo: 2 } },
  { type: 3, n: 4, name: 'Ring', values: { gobo: 3 } },
  { type: 4, n: 1, name: 'Warm 2700', values: { cct: 2700 } },
  { type: 4, n: 2, name: 'Tungsten 3200', values: { cct: 3200 } },
  { type: 4, n: 3, name: 'Studio 4700', values: { cct: 4700 } },
  { type: 4, n: 4, name: 'Daylight 5600', values: { cct: 5600 } },
  { type: 4, n: 5, name: 'Cool 6500', values: { cct: 6500 } },
  { type: 5, n: 1, name: 'Open', values: { iris: 100, shutter: 0 } },
  { type: 5, n: 2, name: 'Iris 60', values: { iris: 60 } },
  { type: 5, n: 3, name: 'Iris 30', values: { iris: 30 } },
  { type: 5, n: 4, name: 'Strobe 1 Hz', values: { shutter: 33 } },
  { type: 6, n: 1, name: 'Narrow', values: { zoom: 10, frost: 0 } },
  { type: 6, n: 2, name: 'Medium', values: { zoom: 19, frost: 0 } },
  { type: 6, n: 3, name: 'Wide', values: { zoom: 34, frost: 0 } },
  { type: 6, n: 4, name: 'Soft', values: { frost: 60, focus: 40 } },
];

export const findPreset = (type: number, n: number) => PRESETS.find((p) => p.type === type && p.n === n);

/* ---------------------------------------------------------------- cues */

export interface Cue {
  n: number;
  name: string;
  fade: number;
  /** Show cues: both spots cross on this plate. */
  slug?: string;
  /** Stored cues: values per fixture, and a plate per spot when a position preset was in. */
  fixtures?: Record<number, Partial<Record<AttrKey, number>>>;
  plates?: Record<number, string>;
  user?: boolean;
}

export type Position =
  | { kind: 'follow' }
  | { kind: 'plate'; slug: string; from: 'programmer' | 'cue' }
  | { kind: 'angles'; pan: number; tilt: number; from: 'programmer' | 'cue' };

export type Source = 'programmer' | 'inactive' | 'cue' | 'default' | 'highlight' | 'executor';

interface ProgVal {
  v: number;
  active: boolean;
}

interface PosPreset {
  slug: string;
  preset: string;
  active: boolean;
}

interface Snapshot {
  prog: [number, [AttrKey, ProgVal][]][];
  pos: [number, PosPreset][];
  sel: number[];
}

const HIGHLIGHT: Partial<Record<AttrKey, number>> = { dim: 100, gobo: 0, iris: 100, shutter: 0, frost: 0, cct: 5600 };

export class Desk {
  prog = new Map<number, Map<AttrKey, ProgVal>>(FIXTURES.map((f) => [f.id, new Map()]));
  posPreset = new Map<number, PosPreset>();
  selection = new Set<number>(SPOTS);
  feature: Feature = 'Dimmer';
  fine = false;
  blind = false;
  highlight = false;
  blackout = false;
  gm = 1;
  exec = {
    1: { level: 1, cue: null as number | null, paused: false },
    2: { level: 0.5, flash: false },
    3: { level: 0, flash: false, auto: false },
    // The panels' Fill is up from the start, on every screen, so the shows read as lit sets.
    4: { level: 0.72, flash: false, auto: false },
  };
  cues: Cue[] = allShows.map((s, i) => ({ n: i + 1, name: s.title, fade: 3, slug: s.slug }));
  private history: Snapshot[] = [];
  private listeners = new Set<() => void>();
  /** Live head angles in degrees per spot, updated by the engine. */
  live: Record<number, { pan: number; tilt: number }> = { 1: { pan: 0, tilt: 30 }, 2: { pan: 0, tilt: 30 } };
  /**
   * The spots' resting dimmer level. A show file's default, not a programmer
   * value: the panels' flood carries the page and the spots are soft accents
   * at 15% on every screen (Miller, 2026-10-22).
   */
  spotDim = 15;
  /** Called when the sequence moves to a cue, so the page can follow it. */
  onCue: (cue: Cue | null) => void = () => {};
  onReset: (id: number) => void = () => {};
  onLamp: (id: number, on: boolean) => void = () => {};

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.listeners.forEach((f) => f());
  }

  fixture(id: number) {
    return FIXTURES.find((f) => f.id === id);
  }

  /* ------------------------------------------------------- programmer */

  private snapshot() {
    this.history.push({
      prog: [...this.prog].map(([id, m]) => [id, [...m].map(([k, v]) => [k, { ...v }] as [AttrKey, ProgVal])]),
      pos: [...this.posPreset].map(([id, p]) => [id, { ...p }] as [number, PosPreset]),
      sel: [...this.selection],
    });
    if (this.history.length > 60) this.history.shift();
  }

  oops() {
    const s = this.history.pop();
    if (!s) return 'Nothing to undo';
    this.prog = new Map(s.prog.map(([id, entries]) => [id, new Map(entries)]));
    this.posPreset = new Map(s.pos);
    this.selection = new Set(s.sel);
    this.emit();
    return 'Oops: last change undone';
  }

  select(ids: number[]) {
    const valid = ids.filter((id) => this.fixture(id));
    if (!valid.length) return `Fixture ${ids.length > 2 ? `${ids[0]} Thru ${ids[ids.length - 1]}` : ids.join(' + ')} does not exist`;
    this.snapshot();
    this.selection = new Set(valid);
    const feats = this.availableFeatures();
    if (!feats.includes(this.feature)) this.feature = feats[0];
    this.emit();
    return `Fixture ${listName(valid)} selected`;
  }

  /** Make sure something is selected before an encoder or preset writes values. */
  ensureSelection(attr?: AttrKey) {
    if (this.selection.size) return null;
    const ids = attr === 'haze' || attr === 'fan' ? [HAZER] : SPOTS;
    this.selection = new Set(ids);
    return `Fixture ${listName(ids)} selected`;
  }

  targets(attr: AttrKey) {
    return [...this.selection].filter((id) => this.fixture(id)?.attrs.includes(attr));
  }

  hasValues() {
    return [...this.prog.values()].some((m) => m.size) || this.posPreset.size > 0;
  }
  hasActive() {
    return [...this.prog.values()].some((m) => [...m.values()].some((v) => v.active)) || [...this.posPreset.values()].some((p) => p.active);
  }

  set(attr: AttrKey, value: number, opts: { record?: boolean } = {}) {
    const d = ATTRS[attr];
    const note = this.ensureSelection(attr);
    const ids = this.targets(attr);
    if (!ids.length) return `${d.name} is not on the selected fixtures`;
    if (opts.record !== false) this.snapshot();
    const v = clamp(d.options ? Math.round(value) : value, d.min, d.max);
    if (attr === 'reset') {
      if (v >= 1) ids.forEach((id) => this.onReset(id));
      this.emit();
      return `Fixture ${listName(ids)} reset`;
    }
    for (const id of ids) {
      const m = this.prog.get(id)!;
      if ((attr === 'pan' || attr === 'tilt') && this.posPreset.has(id)) {
        // Turning Pan or Tilt takes over from a position preset at the current angles.
        m.set('pan', { v: this.live[id].pan, active: true });
        m.set('tilt', { v: this.live[id].tilt, active: true });
        this.posPreset.delete(id);
      }
      m.set(attr, { v, active: true });
      if (attr === 'lamp') this.onLamp(id, v >= 0.5);
    }
    this.emit();
    return note ?? `${d.name} ${d.fmt(v)}`;
  }

  /** Encoder turn, in detents. Each selected fixture moves from its own value. */
  nudge(attr: AttrKey, detents: number, record: boolean) {
    const d = ATTRS[attr];
    const note = this.ensureSelection(attr);
    const ids = this.targets(attr);
    if (!ids.length) return `${d.name} is not on the selected fixtures`;
    if (record) this.snapshot();
    let last = 0;
    for (const id of ids) {
      const cur = attr === 'pan' || attr === 'tilt' ? this.angleNow(id, attr) : this.value(id, attr).v;
      let next: number;
      if (d.options) next = (Math.round(cur) + Math.sign(detents) + d.options.length) % d.options.length;
      else next = clamp(cur + detents * (this.fine ? d.fine : d.step), d.min, d.max);
      const m = this.prog.get(id)!;
      if ((attr === 'pan' || attr === 'tilt') && this.posPreset.has(id)) {
        m.set('pan', { v: this.live[id].pan, active: true });
        m.set('tilt', { v: this.live[id].tilt, active: true });
        this.posPreset.delete(id);
      }
      m.set(attr, { v: next, active: true });
      if (attr === 'lamp') this.onLamp(id, next >= 0.5);
      if (attr === 'reset' && next >= 1) this.onReset(id);
      last = next;
    }
    this.emit();
    return note ?? `${d.name} ${d.fmt(last)}`;
  }

  /** Pan or tilt as the head is right now: programmed if it is, otherwise where it's pointing. */
  angleNow(id: number, attr: 'pan' | 'tilt') {
    const p = this.prog.get(id)!.get(attr);
    return p && !this.posPreset.has(id) ? p.v : this.live[id][attr];
  }

  applyPreset(type: number, n: number) {
    const p = findPreset(type, n);
    if (!p) return `Preset ${type}.${n} is empty`;
    const note = this.ensureSelection(p.slug ? 'pan' : (Object.keys(p.values!)[0] as AttrKey));
    this.snapshot();
    if (p.slug) {
      const spots = [...this.selection].filter((id) => SPOTS.includes(id));
      if (!spots.length) return 'Position presets need a spot selected (Fixture 1 or 2)';
      for (const id of spots) {
        const m = this.prog.get(id)!;
        m.delete('pan');
        m.delete('tilt');
        this.posPreset.set(id, { slug: p.slug, preset: `${type}.${n}`, active: true });
      }
    } else {
      let hit = 0;
      for (const [k, v] of Object.entries(p.values!)) {
        for (const id of this.targets(k as AttrKey)) {
          this.prog.get(id)!.set(k as AttrKey, { v, active: true });
          hit++;
        }
      }
      if (!hit) return `Preset ${type}.${n} has nothing for the selected fixtures`;
    }
    this.emit();
    return note ? `${note}. Preset ${type}.${n} ${p.name}` : `Preset ${type}.${n} ${p.name}`;
  }

  /** The three-stage Clear. */
  clear() {
    this.snapshot();
    let msg: string;
    if (this.selection.size) {
      this.selection.clear();
      msg = 'Selection cleared';
    } else if (this.hasActive()) {
      this.deactivate();
      msg = 'Values deactivated. Clear again to release';
    } else if (this.hasValues()) {
      this.releaseAll();
      msg = 'Programmer cleared';
    } else {
      msg = 'Programmer is empty';
    }
    this.emit();
    return msg;
  }

  clearAll() {
    this.snapshot();
    this.selection.clear();
    this.releaseAll();
    this.emit();
    return 'Programmer cleared';
  }

  clearActive() {
    this.snapshot();
    this.deactivate();
    this.emit();
    return 'Values deactivated';
  }

  clearSelection() {
    this.snapshot();
    this.selection.clear();
    this.emit();
    return 'Selection cleared';
  }

  private deactivate() {
    for (const m of this.prog.values()) for (const v of m.values()) v.active = false;
    for (const p of this.posPreset.values()) p.active = false;
  }

  private releaseAll() {
    for (const m of this.prog.values()) m.clear();
    this.posPreset.clear();
  }

  toggleBlind() {
    this.blind = !this.blind;
    this.emit();
    return this.blind ? 'Blind on: programmer hidden from output' : 'Blind off';
  }
  toggleHighlight() {
    this.highlight = !this.highlight;
    this.emit();
    return this.highlight ? 'Highlight on for the selected fixtures' : 'Highlight off';
  }
  toggleBlackout() {
    this.blackout = !this.blackout;
    this.emit();
    return this.blackout ? 'Blackout' : 'Blackout off';
  }

  /* ---------------------------------------------------------- playback */

  private cueIndex() {
    return this.exec[1].cue == null ? -1 : this.cues.findIndex((c) => c.n === this.exec[1].cue);
  }
  currentCue() {
    const i = this.cueIndex();
    return i >= 0 ? this.cues[i] : null;
  }
  nextCue() {
    const i = this.cueIndex();
    return this.cues[(i + 1) % this.cues.length];
  }

  private run(c: Cue | null) {
    this.exec[1].cue = c ? c.n : null;
    this.exec[1].paused = false;
    this.onCue(c);
    this.emit();
  }

  go() {
    const e = this.exec[1];
    if (e.paused) {
      e.paused = false;
      this.emit();
      return `Sequence 1 resumed, Cue ${e.cue}`;
    }
    const c = this.nextCue();
    this.run(c);
    return `Go: Cue ${c.n} ${c.name}`;
  }

  goBack() {
    const i = this.cueIndex();
    const c = this.cues[(i <= 0 ? this.cues.length : i) - 1];
    this.run(c);
    return `Go-: Cue ${c.n} ${c.name}`;
  }

  pause() {
    const e = this.exec[1];
    if (e.cue == null) return 'Sequence 1 is off';
    e.paused = !e.paused;
    this.emit();
    return e.paused ? `Sequence 1 paused at Cue ${e.cue}` : `Sequence 1 resumed`;
  }

  gotoCue(n: number) {
    const c = this.cues.find((x) => x.n === n);
    if (!c) return `Cue ${n} does not exist`;
    this.run(c);
    return `Goto Cue ${c.n} ${c.name}`;
  }

  off(exec = 1) {
    if (exec === 1) {
      if (this.exec[1].cue == null) return 'Sequence 1 is already off';
      this.run(null);
      return 'Sequence 1 off';
    }
    if (exec >= 2 && exec <= 4) {
      this.setExec(exec, 0);
      return `Executor ${exec} off`;
    }
    return `Executor ${exec} does not exist`;
  }

  setExec(n: number, level: number) {
    const l = clamp(level, 0, 1);
    if (n === 1) this.exec[1].level = l;
    else if (n === 2) this.exec[2].level = l;
    else if (n === 3 || n === 4) {
      this.exec[n].level = l;
      this.exec[n].auto = false;
    } else return `Executor ${n} does not exist`;
    this.emit();
    return `Executor ${n} at ${Math.round(l * 100)}%`;
  }

  store(n?: number, name?: string) {
    if (!this.hasActive()) return 'Nothing active in the programmer to store';
    const num = n ?? Math.max(...this.cues.map((c) => c.n)) + 1;
    const existing = this.cues.find((c) => c.n === num);
    if (existing && !existing.user) return `Cue ${num} is a show cue. Store to a new number`;
    const fixtures: Record<number, Partial<Record<AttrKey, number>>> = {};
    const plates: Record<number, string> = {};
    for (const [id, m] of this.prog) {
      const vals: Partial<Record<AttrKey, number>> = {};
      for (const [k, v] of m) if (v.active && k !== 'reset') vals[k] = v.v;
      if (Object.keys(vals).length) fixtures[id] = vals;
    }
    for (const [id, p] of this.posPreset) if (p.active) plates[id] = p.slug;
    const cue: Cue = { n: num, name: name || `Look ${num}`, fade: 2, fixtures, plates, user: true };
    if (existing) this.cues.splice(this.cues.indexOf(existing), 1, cue);
    else {
      this.cues.push(cue);
      this.cues.sort((a, b) => a.n - b.n);
    }
    this.emit();
    return `Stored Cue ${num} ${cue.name}`;
  }

  /* ------------------------------------------------------------ output */

  value(fixture: number, attr: AttrKey): { v: number; src: Source } {
    const kind = this.fixture(fixture)?.kind;
    const p = this.prog.get(fixture)?.get(attr);
    if (kind === 'hazer') {
      if (p && !this.blind) return { v: p.v, src: p.active ? 'programmer' : 'inactive' };
      if (attr === 'haze') return { v: this.exec[2].flash ? 100 : this.exec[2].level * 100, src: 'executor' };
      return { v: ATTRS[attr].def, src: 'default' };
    }
    if (this.highlight && this.selection.has(fixture) && attr in HIGHLIGHT) return { v: HIGHLIGHT[attr]!, src: 'highlight' };
    if (p && !this.blind) return { v: p.v, src: p.active ? 'programmer' : 'inactive' };
    const c = this.currentCue();
    const cv = c?.fixtures?.[fixture]?.[attr];
    if (cv != null) return { v: cv, src: 'cue' };
    if (kind === 'panel' && attr === 'dim') return { v: (this.exec[4].flash ? 1 : this.exec[4].level) * 100, src: 'executor' };
    if (kind === 'spot' && attr === 'dim' && c) return { v: this.spotDim * this.exec[1].level, src: 'cue' };
    if (kind === 'spot' && attr === 'dim') return { v: this.spotDim, src: 'default' };
    return { v: ATTRS[attr].def, src: 'default' };
  }

  position(id: number): Position {
    if (!this.blind) {
      const pp = this.posPreset.get(id);
      if (pp) return { kind: 'plate', slug: pp.slug, from: 'programmer' };
      const m = this.prog.get(id)!;
      const pan = m.get('pan'), tilt = m.get('tilt');
      if (pan || tilt) return { kind: 'angles', pan: pan?.v ?? this.live[id].pan, tilt: tilt?.v ?? this.live[id].tilt, from: 'programmer' };
    }
    const c = this.currentCue();
    if (c) {
      const slug = c.plates?.[id] ?? c.slug;
      if (slug) return { kind: 'plate', slug, from: 'cue' };
      const f = c.fixtures?.[id];
      if (f && (f.pan != null || f.tilt != null)) return { kind: 'angles', pan: f.pan ?? this.live[id].pan, tilt: f.tilt ?? this.live[id].tilt, from: 'cue' };
    }
    return { kind: 'follow' };
  }

  /** Source of the position, for the Pan and Tilt displays. */
  positionLabel(id: number): { text: string; src: Source } | null {
    const pp = this.posPreset.get(id);
    if (!this.blind && pp) return { text: `P ${pp.preset}`, src: pp.active ? 'programmer' : 'inactive' };
    return null;
  }

  sweepSize() {
    return this.exec[3].flash ? 1 : this.exec[3].level;
  }

  /** Final intensity 0..1 after the Grand Master and B.O. */
  intensity(id: number) {
    if (this.blackout) return 0;
    const kind = this.fixture(id)?.kind;
    const lamp = kind === 'spot' ? (this.value(id, 'lamp').v >= 0.5 ? 1 : 0) : 1;
    return (this.value(id, 'dim').v / 100) * this.gm * lamp;
  }

  availableFeatures(): Feature[] {
    const ids = this.selection.size ? [...this.selection] : SPOTS;
    const set = new Set<Feature>();
    for (const id of ids) for (const a of this.fixture(id)!.attrs) set.add(ATTRS[a].feature);
    return FEATURES.filter((f) => set.has(f));
  }

  /** The attributes on the encoders for the current feature, up to five. */
  encoderAttrs(): (AttrKey | null)[] {
    const ids = this.selection.size ? [...this.selection] : SPOTS;
    const keys: AttrKey[] = [];
    for (const id of ids) for (const a of this.fixture(id)!.attrs) if (ATTRS[a].feature === this.feature && !keys.includes(a)) keys.push(a);
    const out: (AttrKey | null)[] = keys.slice(0, 5);
    while (out.length < 5) out.push(null);
    return out;
  }
}

/** "1 + 2", "1 Thru 4", the way the desk writes a fixture list. */
export function listName(ids: number[]) {
  const s = [...ids].sort((a, b) => a - b);
  if (s.length > 2 && s[s.length - 1] - s[0] === s.length - 1) return `${s[0]} Thru ${s[s.length - 1]}`;
  return s.join(' + ');
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
