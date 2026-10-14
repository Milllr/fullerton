# Fullerton Productions site

Portfolio for James Downey (Miller's dad), Lighting Designer, Fullerton Productions, Toronto. Vite + vanilla TypeScript, no framework.

- Concept: dark stage, every show is a hairline sketch traced from photos; one moving head (wireframe, top centre, hangs off the truss header) follows the cursor and reveals the real photo inside its pool. Small console: dimmer, zoom, colour temp, haze, gobo, Go.
- Motion rule from James's lighting doctrine: nothing snaps. Pan/tilt use a damped spring with capped speed; idle sweep is 24 s across.
- Copy is deliberately minimal: names, networks, years. No bio. No dashes (en or em) in copy.
- Contact email/phone in `src/data/site.ts` stay empty until Miller confirms real ones. Never invent contact details.
- Credits must be sourced (NewscastStudio, TV Technology) or come from the family photo archive. Don't add unverified credits.
- `raw/` holds original photos and is gitignored; `npm run assets` rebuilds `public/shows/` and `src/data/assets.json`.
- Domain is fullertonproductions.ca (moving to Cloudflare later).
