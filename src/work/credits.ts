import type { Credit } from '../data/shows';
import { esc } from '../lib/dom';

/** Every credit, newest first, set like the credits on the back of a sleeve. Shows with photos open their sheet. */
export function renderCredits(root: HTMLElement, credits: Credit[]) {
  const sorted = [...credits].sort((a, b) => (b.sortYear || -1) - (a.sortYear || -1) || a.production.localeCompare(b.production));
  root.innerHTML = `<table class="credits-table">
    <thead><tr><th scope="col">Year</th><th scope="col">Production</th><th scope="col">Network</th><th scope="col">Source</th></tr></thead>
    <tbody>${sorted
      .map((c) => {
        const prod = c.show ? `<a href="#/work/${c.show}">${esc(c.production)}</a>` : esc(c.production);
        const src = c.source
          ? `<a href="${c.source.url}" target="_blank" rel="noopener">${esc(c.source.label)}<span aria-hidden="true"> ↗</span></a>`
          : '';
        return `<tr><td class="cr-year">${esc(c.year)}</td><td class="cr-prod">${prod}</td><td class="cr-net">${esc(c.network)}</td><td class="cr-src">${src}</td></tr>`;
      })
      .join('')}</tbody></table>`;
}
