import { imageUrl, keyImage, type Credit, type Show } from '../data/shows';
import { esc, setVar, smooth, Spring } from '../lib/dom';
import { Filament, kelvinRgb, rgbTriplet } from '../light/tungsten';

/*
  All of his work in one list, newest first, set like the credits on the
  back of a sleeve: the year once for each year, the production, network
  and kind, and how to see more. Shows with photos open their sheet; on a
  pointer, a frosted print of the show follows along beside the row and
  comes up like a lamp.
*/

const ext = (url: string, label: string) =>
  `<a class="aw-src" href="${url}" target="_blank" rel="noopener">${esc(label)}<span aria-hidden="true"> ↗</span></a>`;

export class WorkList {
  private preview: HTMLElement;
  private img: HTMLImageElement;
  private f = new Filament(0.24);
  private on: Show | null = null;
  private x = new Spring(0, 2.2, 0.9);
  private y = new Spring(0, 2.2, 0.9);
  private tx = 0;
  private ty = 0;
  private seen = false;

  constructor(
    root: HTMLElement,
    credits: Credit[],
    private shows: Show[],
    private reduced: boolean,
  ) {
    const sorted = [...credits].sort(
      (a, b) => (b.sortYear || -1) - (a.sortYear || -1) || a.production.localeCompare(b.production),
    );
    let lastYear: string | null = null;
    const rows = sorted.map((c) => {
      const s = c.show ? shows.find((x) => x.slug === c.show) : undefined;
      const starts = c.year !== lastYear;
      const year = starts ? esc(c.year) : '';
      lastYear = c.year;
      const title = s
        ? `<a class="aw-title" href="#/work/${s.slug}">${esc(c.production)}</a>`
        : `<span class="aw-title">${esc(c.production)}</span>`;
      const note = c.note
        ? `<span class="aw-note">${esc(c.note.text)}${c.note.source ? ` ${ext(c.note.source.url, c.note.source.label)}` : ''}</span>`
        : '';
      const photos = s ? `<a class="aw-photos" href="#/work/${s.slug}">${s.images.length} photos<span aria-hidden="true"> →</span></a>` : '';
      const src = c.source ? ext(c.source.url, c.source.label) : '';
      return `<li class="aw-row${s ? ' has-photos' : ''}${starts ? ' starts' : ''}"${s ? ` data-show="${s.slug}"` : ''}>
        <span class="aw-year">${year}</span>
        <span class="aw-main">${title}${note}</span>
        <span class="aw-sub"><span class="aw-net">${esc(c.network)}</span><span class="aw-kind">${esc(c.kind)}</span></span>
        <span class="aw-links">${photos}${src}</span>
      </li>`;
    });
    root.innerHTML = `<ol class="aw-list">${rows.join('')}</ol>`;

    this.preview = document.createElement('div');
    this.preview.className = 'aw-preview';
    this.preview.setAttribute('aria-hidden', 'true');
    this.preview.innerHTML = '<img alt="" /><i class="pl-tint"></i>';
    document.body.append(this.preview);
    this.img = this.preview.querySelector('img')!;

    root.querySelectorAll<HTMLElement>('.aw-row.has-photos').forEach((row) => {
      row.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        const s = this.shows.find((x) => x.slug === row.dataset.show)!;
        this.point(e.clientX, e.clientY);
        if (s === this.on) return;
        this.on = s;
        this.img.src = imageUrl(s.slug, keyImage(s).id, 'm');
        // A new print comes up from cold.
        this.f.theta = Math.min(this.f.theta, 0.35);
      });
      row.addEventListener('pointermove', (e) => this.point(e.clientX, e.clientY));
      row.addEventListener('pointerleave', () => (this.on = null));
    });
  }

  private point(x: number, y: number) {
    this.tx = x;
    this.ty = y;
    if (!this.seen) {
      this.x.set(x);
      this.y.set(y);
      this.seen = true;
    }
  }

  update(dt: number) {
    const f = this.f;
    if (this.reduced) f.settle(this.on ? 1 : 0);
    else f.step(this.on ? 1 : 0, dt);
    const lit = f.bright;
    const g = f.glow;
    if (lit < 0.002 && g < 0.002 && !this.on) {
      if (this.preview.style.visibility !== 'hidden') this.preview.style.visibility = 'hidden';
      this.seen = false;
      return;
    }
    if (this.preview.style.visibility !== 'visible') this.preview.style.visibility = 'visible';
    const x = this.reduced ? this.tx : this.x.step(this.tx, dt);
    const y = this.reduced ? this.ty : this.y.step(this.ty, dt);
    // Out to the right of the title being read, level with the row.
    const w = Math.min(340, Math.max(220, innerWidth * 0.22));
    const px = Math.min(innerWidth - w - 70, Math.max(x + 70, innerWidth * 0.42));
    const t = `translate3d(${px.toFixed(1)}px,${(y - w / 3).toFixed(1)}px,0)`;
    if (this.preview.style.transform !== t) this.preview.style.transform = t;
    const bb = kelvinRgb(Math.max(1000, f.kelvin));
    const warm = Math.min(1, g * 1.6) * (1 - 0.75 * lit * lit);
    setVar(this.preview, '--tint', rgbTriplet([0, 1, 2].map((k) => 1 + (bb[k] - 1) * warm) as [number, number, number]));
    setVar(this.preview, '--lit', smooth(0, 0.6, Math.max(lit, g * 0.6)).toFixed(3));
  }
}
