import { ATTRS, type AttrKey, type Desk } from './model';

/*
  A working subset of grandMA command syntax. Keywords can be shortened the
  way the desk allows (Fi, At, Th, Pre, Exec, Got...). A trailing Please is
  optional; the Please key and Enter both execute.
*/

export interface Result {
  ok: boolean;
  msg: string;
}

const KEYWORDS: Record<string, string[]> = {
  fixture: ['fixture', 'fixt', 'fix', 'fi'],
  at: ['at'],
  thru: ['thru', 'through', 'th'],
  full: ['full', 'fu'],
  zero: ['zero'],
  preset: ['preset', 'pres', 'pre', 'pr'],
  go: ['go', 'go+'],
  goback: ['go-', 'goback'],
  pause: ['pause', 'pau'],
  goto: ['goto', 'got'],
  cue: ['cue', 'cu'],
  off: ['off'],
  on: ['on'],
  executor: ['executor', 'exec', 'exe', 'ex'],
  sequence: ['sequence', 'seq', 'sq'],
  clear: ['clear', 'clr'],
  clearall: ['clearall'],
  clearactive: ['clearactive'],
  clearselection: ['clearselection'],
  oops: ['oops'],
  highlight: ['highlight', 'highlt', 'hi'],
  blind: ['blind', 'bl'],
  store: ['store', 'sto', 'st'],
  attribute: ['attribute', 'attrib', 'attr', 'att'],
  help: ['help', '?'],
  please: ['please'],
  plus: ['+'],
};

const lookup = new Map<string, string>();
for (const [k, list] of Object.entries(KEYWORDS)) for (const w of list) lookup.set(w, k);

const kw = (t?: string) => (t ? lookup.get(t.toLowerCase()) ?? null : null);

function tokenize(s: string) {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] != null ? `"${m[1]}` : m[2]);
  // Split "1+2" style input into separate tokens, but keep Go+ and Go-.
  return out.flatMap((t) => (/^go[+-]$/i.test(t) || t.startsWith('"') ? [t] : t.split(/(\+)/).filter(Boolean)));
}

const isNum = (t?: string) => !!t && /^-?\d+(\.\d+)?$/.test(t);

export function attrFromName(name: string): AttrKey | null {
  const n = name.replace(/^"/, '').toLowerCase().replace(/\s+/g, '');
  for (const a of Object.values(ATTRS)) {
    if (a.name.toLowerCase().replace(/\s+/g, '') === n || a.aliases.some((x) => x.replace(/\s+/g, '') === n)) return a.key;
  }
  return null;
}

export const HELP = [
  'Fixture 1 Thru 2 At 75 (the spots)',
  'Fixture 3 + 4 At 60 (the panels)',
  'Fixture 5 At 80 (the hazer)',
  'Attribute "Zoom" At 30',
  'Preset 2.3   Preset 4.2',
  'Go   Go-   Pause   Goto Cue 4   Off',
  'Executor 3 At 60   Executor 4 At 70 (Fill)',
  'Store Cue 12 "My look"',
  'Clear   ClearAll   Oops   Highlight   Blind',
];

export function execute(desk: Desk, input: string): Result {
  let t = tokenize(input.trim());
  while (t.length && kw(t[t.length - 1]) === 'please') t.pop();
  if (!t.length) return { ok: true, msg: '' };
  const ok = (msg: string) => ({ ok: !/does not|not on|is empty|needs|nothing|is a show|already off|is off/i.test(msg), msg });
  const err = (msg: string) => ({ ok: false, msg });
  const first = kw(t[0]);

  switch (first) {
    case 'help':
      return { ok: true, msg: HELP.join('\n') };
    case 'clear':
      return ok(desk.clear());
    case 'clearall':
      return ok(desk.clearAll());
    case 'clearactive':
      return ok(desk.clearActive());
    case 'clearselection':
      return ok(desk.clearSelection());
    case 'oops':
      return ok(desk.oops());
    case 'highlight':
    case 'blind': {
      const want = kw(t[1]);
      const cur = first === 'blind' ? desk.blind : desk.highlight;
      if ((want === 'on' && cur) || (want === 'off' && !cur)) return ok(`${first === 'blind' ? 'Blind' : 'Highlight'} is already ${want}`);
      return ok(first === 'blind' ? desk.toggleBlind() : desk.toggleHighlight());
    }
    case 'go':
    case 'goback':
    case 'pause': {
      const target = execTarget(t.slice(1));
      if (target && target !== 1) return err(`Executor ${target} has no sequence. Sequence 1 is on Executor 1`);
      return ok(first === 'go' ? desk.go() : first === 'goback' ? desk.goBack() : desk.pause());
    }
    case 'goto': {
      const rest = kw(t[1]) === 'cue' ? t.slice(2) : t.slice(1);
      if (!isNum(rest[0])) return err('Goto needs a cue number, like Goto Cue 3');
      return ok(desk.gotoCue(Number(rest[0])));
    }
    case 'cue': {
      if (!isNum(t[1])) return err('Cue needs a number, like Goto Cue 3');
      return ok(desk.gotoCue(Number(t[1])));
    }
    case 'off': {
      const target = execTarget(t.slice(1)) ?? 1;
      return ok(desk.off(target));
    }
    case 'executor': {
      if (!isNum(t[1])) return err('Executor needs a number, like Executor 2 At 50');
      const n = Number(t[1]);
      if (kw(t[2]) !== 'at') return err(`Executor ${n}: use At to set its fader, like Executor ${n} At 50`);
      const v = level(t[3]);
      if (v == null) return err('At needs a value');
      return ok(desk.setExec(n, v / 100));
    }
    case 'store': {
      let rest = t.slice(1);
      if (kw(rest[0]) === 'cue') rest = rest.slice(1);
      const n = isNum(rest[0]) ? Number(rest[0]) : undefined;
      const name = rest.find((x) => x.startsWith('"'))?.slice(1);
      return ok(desk.store(n, name));
    }
    case 'preset': {
      const p = presetNum(t[1]);
      if (!p) return err('Preset needs a pool and number, like Preset 4.2');
      return ok(desk.applyPreset(p[0], p[1]));
    }
    case 'attribute': {
      const a = attrFromName(t[1] ?? '');
      if (!a) return err(`Unknown attribute ${t[1] ?? ''}. Try Pan, Tilt, Zoom, Iris, Gobo, Color Temp`);
      return setAttr(desk, a, t.slice(2));
    }
    case 'full':
      return atValue(desk, ['at', 'full']);
    case 'at':
      return atValue(desk, t);
    case 'fixture':
    case null: {
      // A bare number uses Fixture as the default keyword.
      const rest = first === 'fixture' ? t.slice(1) : t;
      if (first === null && !isNum(rest[0])) {
        const a = attrFromName(t[0]);
        if (a && kw(t[1]) === 'at') return setAttr(desk, a, t.slice(1));
        return err(`Unknown command: ${input.trim()}. Type Help for the list`);
      }
      const { ids, i } = fixtureList(rest);
      if (!ids.length) return err('Fixture needs a number, like Fixture 1');
      const sel = desk.select(ids);
      if (/does not/.test(sel)) return err(sel);
      if (i < rest.length) {
        if (kw(rest[i]) === 'at') return atValue(desk, rest.slice(i), sel);
        if (kw(rest[i]) === 'full') return atValue(desk, ['at', 'full'], sel);
        return err(`Expected At after ${sel.replace(' selected', '')}`);
      }
      return { ok: true, msg: sel };
    }
    default:
      return err(`Unknown command: ${input.trim()}. Type Help for the list`);
  }
}

function execTarget(t: string[]): number | null {
  const k = kw(t[0]);
  if ((k === 'executor' || k === 'sequence') && isNum(t[1])) return Number(t[1]);
  return null;
}

function level(t?: string): number | null {
  const k = kw(t);
  if (k === 'full') return 100;
  if (k === 'zero') return 0;
  return isNum(t) ? Number(t) : null;
}

function presetNum(t?: string): [number, number] | null {
  const m = t?.match(/^(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function fixtureList(t: string[]) {
  const ids: number[] = [];
  let i = 0;
  while (i < t.length && isNum(t[i])) {
    const a = Number(t[i]);
    if (kw(t[i + 1]) === 'thru' && isNum(t[i + 2])) {
      const b = Number(t[i + 2]);
      // A typo like Thru 999999 shouldn't hang the page: there are only a handful of fixtures.
      const lo = Math.max(0, Math.min(a, b)), hi = Math.min(Math.max(a, b), lo + 99);
      for (let n = lo; n <= hi; n++) ids.push(n);
      i += 3;
    } else {
      ids.push(a);
      i += 1;
    }
    if (kw(t[i]) === 'plus') i += 1;
    else break;
  }
  return { ids, i };
}

/** "At 50", "At Full", "At Preset 4.2" against the current selection. */
function atValue(desk: Desk, t: string[], prefix?: string): Result {
  if (!desk.selection.size) return { ok: false, msg: 'No fixtures selected. Try Fixture 1 Thru 2 At 50' };
  if (kw(t[1]) === 'preset') {
    const p = presetNum(t[2]);
    if (!p) return { ok: false, msg: 'At Preset needs a pool and number, like At Preset 4.2' };
    return { ok: true, msg: desk.applyPreset(p[0], p[1]) };
  }
  const v = level(t[1]);
  if (v == null) return { ok: false, msg: 'At needs a value, like At 50 or At Full' };
  const msgs: string[] = [];
  if (desk.targets('dim').length) msgs.push(desk.set('dim', v));
  if (desk.targets('haze').length) msgs.push(desk.set('haze', v));
  const body = msgs.join(', ');
  return { ok: true, msg: prefix ? `${prefix.replace(' selected', '')}: ${body}` : body };
}

function setAttr(desk: Desk, a: AttrKey, t: string[]): Result {
  if (kw(t[0]) !== 'at') return { ok: false, msg: `Use At to set ${ATTRS[a].name}, like Attribute "${ATTRS[a].name}" At 30` };
  const d = ATTRS[a];
  let v = level(t[1]);
  if (v == null && d.options && t[1]) {
    const idx = d.options.findIndex((o) => o.toLowerCase() === t[1].replace(/^"/, '').toLowerCase());
    if (idx >= 0) v = idx;
  }
  if (v == null) return { ok: false, msg: `${d.name} needs a value` };
  if (kw(t[1]) === 'full') v = d.max;
  const msg = desk.set(a, v);
  return { ok: !/not on/.test(msg), msg };
}
