# Fullerton Productions site

Portfolio for James Downey (Miller's dad), Lighting Designer, Fullerton Productions, Toronto. Vite + vanilla TypeScript, no framework.

- Concept: dark stage, every show is a hairline sketch traced from photos; a rig hangs off the truss under the nav: Spot L (1) and Spot R (2) moving heads at the wings, Panel L (3) and Panel R (4) soft panels inside pointing straight down, Hazer (5). Light reveals the real photo.
- Behaviour Miller chose: desktop, both spots converge on the cursor and the panels stay off until Exec 4 Fill is raised. Touch screens, Fill auto-raises to 72% after the opening so the show in the middle of the screen is flooded as you scroll; spots cross on that show (Spot L lands right of centre, Spot R left) and roam slowly; a finger drag pulls both spots to it, back to roaming 1.2 s after release.
- Controls: a pull-up desk modelled faithfully on grandMA3 (src/desk/): programmer with 3-stage Clear, feature groups, encoders, executors, preset pools, real MA command syntax. Miller wants it fully industrial and physical; keep MA conventions (yellow selection, red programmer values, cyan playback).
- Miller picked version A: the desk and header chrome are industrial, the rest of the site stays quiet and minimal. Version B (whole site industrial) was dropped.
- Light should leak across the scene naturally (physical, subtle): hot centre with field fall-off, throw fall-off, faint photo spill past the pool, gobo floor pool, colour bounce, shaft scatter, desk-lip spill, crossing pools screen rather than add. See README, How the light behaves.
- Headless Chromium here renders at about 1 fps; use `?fast` (dev only) and `window.__rig` (dev only) for tests. Use the `.ts` style helpers in src/engine/css.ts (setVar, setText) for per-frame DOM writes.
- The URL hash only ever holds an open show; in-page links scroll without touching it (see README, Browsers and devices).
- Motion rule from James's lighting doctrine: nothing snaps. Pan/tilt use a damped spring with capped speed; idle sweep is 24 s across.
- Copy is deliberately minimal: names, networks, years. No bio. No dashes (en or em) in copy.
- Contact in `src/data/site.ts`: fullertonproductions@me.com and 416 882 1379 (shown spaced, no dashes; tel link +14168821379), confirmed by Miller 2026-10-15. Never invent or change contact details without him.
- Credits must be sourced (NewscastStudio, TV Technology) or come from the family photo archive. Don't add unverified credits.
- `raw/` holds original photos and is gitignored; `npm run assets` rebuilds `public/shows/` and `src/data/assets.json`.
- Domain is fullertonproductions.ca (moving to Cloudflare later).
