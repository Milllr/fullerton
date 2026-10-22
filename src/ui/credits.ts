import type { Credit } from '../data/shows';

type Key = 'year' | 'production' | 'network';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function renderCredits(root: HTMLElement, credits: Credit[]) {
  let key: Key = 'year';
  let dir = -1;

  const sorted = () =>
    [...credits].sort((a, b) => {
      if (key === 'year') {
        // Undated credits always sit at the end.
        if (!a.sortYear !== !b.sortYear) return a.sortYear ? -1 : 1;
        return (a.sortYear - b.sortYear) * dir || a.production.localeCompare(b.production);
      }
      return a[key].localeCompare(b[key]) * dir;
    });

  const head = (k: Key, label: string) => {
    const active = k === key;
    const sort = active ? (dir === 1 ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" aria-sort="${sort}"><button type="button" data-k="${k}">${label}<span class="sort-mark" aria-hidden="true">${active ? (dir === 1 ? '↑' : '↓') : ''}</span></button></th>`;
  };

  const draw = () => {
    const rows = sorted()
      .map((c) => {
        const title = c.show ? `<a href="#/work/${c.show}">${esc(c.production)}</a>` : esc(c.production);
        const note = c.note
          ? `<span class="c-note">${c.note.source ? `<a href="${c.note.source.url}" target="_blank" rel="noopener">${esc(c.note.text)}</a>` : esc(c.note.text)}</span>`
          : '';
        const src = c.source ? `<a class="src" href="${c.source.url}" target="_blank" rel="noopener">${esc(c.source.label)}</a>` : '';
        return `<tr>
          <td class="c-year">${esc(c.year)}</td>
          <td class="c-prod">${title}${note}</td>
          <td class="c-net">${esc(c.network)}</td>
          <td class="c-src">${src}</td>
        </tr>`;
      })
      .join('');
    root.innerHTML = `
      <table class="cue-list">
        <caption class="sr-only">Every production, sortable by year, production or network</caption>
        <thead><tr>${head('year', 'Year')}${head('production', 'Production')}${head('network', 'Network or client')}<th scope="col"><span class="sr-only">Press</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    root.querySelectorAll<HTMLButtonElement>('th button').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k as Key;
        if (k === key) dir = -dir as 1 | -1;
        else {
          key = k;
          dir = k === 'year' ? -1 : 1;
        }
        draw();
        root.querySelector<HTMLButtonElement>(`th button[data-k="${k}"]`)?.focus();
      }),
    );
  };
  draw();
}
