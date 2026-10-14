import { imageUrl, type Show } from '../data/shows';
import { coverMapping, drawSketch, loadSketch } from '../engine/plate';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The show sheet: every photo from one show, each one drawn as a sketch
 * first and then brought up to full like a lighting cue.
 */
export class Sheet {
  private root: HTMLElement;
  private show: Show | null = null;
  private index = 0;
  private returnFocus: HTMLElement | null = null;
  private reduced: boolean;
  onClose: () => void = () => {};
  private token = 0;

  constructor(root: HTMLElement, reduced: boolean) {
    this.root = root;
    this.reduced = reduced;
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.onClose();
      else if (e.key === 'ArrowRight') this.step(1);
      else if (e.key === 'ArrowLeft') this.step(-1);
      else if (e.key === 'Tab') this.trap(e);
    });
    addEventListener('resize', () => this.show && this.paintSketch());
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(show: Show, from?: HTMLElement | null) {
    this.show = show;
    this.index = 0;
    this.returnFocus = from ?? (document.activeElement as HTMLElement);
    const meta = [show.network, show.year].filter(Boolean).join(', ');
    const thumbs = show.images
      .map(
        (im, i) => `<li><button type="button" data-i="${i}" aria-label="Photo ${i + 1} of ${show.images.length}">
          <img src="${imageUrl(show.slug, im.id, 'm')}" alt="" loading="lazy" width="${im.w}" height="${im.h}" /></button></li>`,
      )
      .join('');
    const src = show.source
      ? `<a class="sheet-src" href="${show.source.url}" target="_blank" rel="noopener">See it on ${esc(show.source.label)}</a>`
      : '';
    this.root.innerHTML = `
      <div class="sheet-inner">
        <header class="sheet-head">
          <div>
            <h2 id="sheet-title">${esc(show.title)}</h2>
            <p class="sheet-meta">${esc(meta)}</p>
          </div>
          <button class="sheet-close" type="button">Close</button>
        </header>
        <figure class="sheet-figure">
          <div class="sheet-frame">
            <canvas class="sheet-sketch" aria-hidden="true"></canvas>
            <img class="sheet-photo" alt="" />
          </div>
          <figcaption class="sheet-cap">
            <span class="sheet-count"></span>
            <span class="sheet-credit"></span>
            ${src}
          </figcaption>
        </figure>
        <div class="sheet-nav">
          <button class="sheet-prev" type="button">Previous</button>
          <button class="sheet-next" type="button">Next</button>
        </div>
        <ol class="sheet-strip">${thumbs}</ol>
      </div>`;
    this.root.querySelector('.sheet-close')!.addEventListener('click', () => this.onClose());
    this.root.querySelector('.sheet-prev')!.addEventListener('click', () => this.step(-1));
    this.root.querySelector('.sheet-next')!.addEventListener('click', () => this.step(1));
    this.root.querySelectorAll<HTMLButtonElement>('.sheet-strip button').forEach((b) =>
      b.addEventListener('click', () => this.go(Number(b.dataset.i))),
    );
    const single = show.images.length < 2;
    this.root.querySelector<HTMLElement>('.sheet-nav')!.hidden = single;
    this.root.querySelector<HTMLElement>('.sheet-strip')!.hidden = single;
    this.root.hidden = false;
    document.documentElement.classList.add('sheet-open');
    requestAnimationFrame(() => this.root.classList.add('is-open'));
    this.go(0);
    this.root.querySelector<HTMLButtonElement>('.sheet-close')!.focus();
  }

  close() {
    if (this.root.hidden) return;
    this.root.classList.remove('is-open');
    document.documentElement.classList.remove('sheet-open');
    const done = () => {
      this.root.hidden = true;
      this.root.innerHTML = '';
      this.show = null;
    };
    if (this.reduced) done();
    else setTimeout(done, 380);
    this.returnFocus?.focus({ preventScroll: true });
  }

  private step(d: number) {
    if (!this.show) return;
    const n = this.show.images.length;
    this.go((this.index + d + n) % n);
  }

  private async go(i: number) {
    const show = this.show;
    if (!show) return;
    this.index = i;
    const im = show.images[i];
    const token = ++this.token;
    const frame = this.root.querySelector<HTMLElement>('.sheet-frame')!;
    const photo = this.root.querySelector<HTMLImageElement>('.sheet-photo')!;
    frame.style.setProperty('--ar', `${im.w} / ${im.h}`);
    frame.style.setProperty('--arn', String(im.w / im.h));
    frame.classList.remove('is-up');
    photo.alt = `${show.title}, photo ${i + 1} of ${show.images.length}`;
    this.root.querySelector('.sheet-count')!.textContent = show.images.length > 1 ? `${i + 1} of ${show.images.length}` : '';
    this.root.querySelector('.sheet-credit')!.textContent = im.credit ? `Photo: ${im.credit}` : '';
    this.root.querySelectorAll('.sheet-strip button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    photo.src = imageUrl(show.slug, im.id, 'full');
    await this.paintSketch();
    try {
      await photo.decode();
    } catch {
      /* the image will still show when it arrives */
    }
    if (token !== this.token) return;
    // Bring the photo up out of its sketch.
    requestAnimationFrame(() => frame.classList.add('is-up'));
  }

  private async paintSketch() {
    const show = this.show;
    if (!show) return;
    const im = show.images[this.index];
    const c = this.root.querySelector<HTMLCanvasElement>('.sheet-sketch');
    if (!c) return;
    const data = await loadSketch(show.slug, im.id);
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSketch(ctx, data, coverMapping(r.width, r.height, im.h / im.w), { weight: 1.6 });
  }

  private trap(e: KeyboardEvent) {
    const f = [...this.root.querySelectorAll<HTMLElement>('button, a[href]')].filter((el) => !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
