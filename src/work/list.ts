import type { Credit, Show } from '../data/shows';
import { esc } from '../lib/dom';
import type { Preview } from './preview';

/*
  All of his work in one list, newest first, set like the credits on the
  back of a sleeve: the year once for each year, then the production,
  network and kind. The whole row is the link: shows with photos open
  their sheet (and, on a pointer, a print of the show comes up above it);
  the rest open where the credit comes from.
*/

export function renderList(root: HTMLElement, credits: Credit[], shows: Show[], preview: Preview) {
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
      : c.source
        ? `<a class="aw-title" href="${c.source.url}" target="_blank" rel="noopener">${esc(c.production)}<span class="aw-out" aria-hidden="true"> ↗</span><span class="sr"> (${esc(c.source.label)})</span></a>`
        : `<span class="aw-title">${esc(c.production)}</span>`;
    const note = c.note
      ? `<span class="aw-note">${esc(c.note.text)}${c.note.source ? ` <a class="aw-note-src" href="${c.note.source.url}" target="_blank" rel="noopener">${esc(c.note.source.label)}<span aria-hidden="true"> ↗</span></a>` : ''}</span>`
      : '';
    return `<li class="aw-row${s ? ' has-photos' : ''}${starts ? ' starts' : ''}"${s ? ` data-show="${s.slug}"` : ''}>
        <span class="aw-year">${year}</span>
        <span class="aw-main">${title}${note}</span>
        <span class="aw-sub"><span class="aw-net">${esc(c.network)}</span><span class="aw-kind">${esc(c.kind)}</span></span>
      </li>`;
  });
  root.innerHTML = `<ol class="aw-list">${rows.join('')}</ol>`;
  root.querySelectorAll<HTMLElement>('.aw-row.has-photos').forEach((row) =>
    preview.attach(row, shows.find((x) => x.slug === row.dataset.show)!),
  );
}
