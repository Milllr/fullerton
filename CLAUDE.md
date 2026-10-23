# Fullerton Productions site

Portfolio for James Downey (Miller's dad), Lighting Designer, Fullerton Productions, Toronto. Vite + vanilla TypeScript, no framework.

- This is the `tungsten` branch: a full rebuild under a new aesthetic Miller asked for on 2026-10-22, from his mood board (Nissan Le Mans 1998 ad, Dstrukt "Fraktur.Ation", grainy cream and orange gradient blobs, a half frosted architecture card, a Masako Ohta record sleeve, a Jeep topo map ad, and the Unveil studio site's stacked project planes). Highly minimal, warm 2000s gradient, tech type, artistic interaction applied sparingly, built around a simple tungsten bulb. The old dark stage site (Vectorworks drawings, grandMA3 desk) stays on `main`; its rules don't apply here.
- Concept: one sheet of warm paper lit by one tungsten lamp (channel 1) hanging on its flex. Drag it to dim, tap to switch, brush it to swing; it hangs low on the cover, flies out to read, comes partway down at contact. The whole palette rides the black body curve as it dims (cream, amber, orange, ember, blue hour grey when out). See README, The lamp.
- The filament is modelled, not faded (thermal lag, T as V^0.4, output as V^3.4): src/lamp/tungsten.ts. Every reveal on the site (the plates, the sheet photos) comes up on that same curve. Keep it physical: an LD should recognise tungsten.
- Isolux contours (hairline rings in lux, labelled like a topo map) are the photometric plot of the same light, from the lamp's height. src/lamp/field.ts draws paper, light, contours and grain in one shader.
- Work: track list index plus a stack of frosted plates in depth (Unveil reference). A show opens full bleed under frost with a draggable frost edge (Grundtvig reference). See README, The work.
- Type: Michroma for the few display words (name, section titles, show titles, years, contact), Fragment Mono for everything else. Ink on paper; colour comes only from the lamp.
- Motion rule from James's lighting doctrine: nothing snaps. Everything moves on damped springs or the filament's own curve.
- Headless Chromium here runs at about 10 fps with SwiftShader; for stills use reduced motion and `window.__tungsten` (dev only). In Git Bash, set `MSYS_NO_PATHCONV=1` before passing `#/work/...` anywhere or it gets turned into a Windows path.
- Use the helpers in src/lib/dom.ts (setVar, setText, setAttr, Spring) for per-frame DOM writes.
- The URL hash only ever holds an open show; in-page links scroll without touching it.
- Copy is deliberately minimal: names, networks, years. No bio. No dashes (en or em) in copy.
- Contact in `src/data/site.ts`: fullertonproductions@me.com and 416 882 1379 (shown spaced, no dashes; tel link +14168821379), confirmed by Miller 2026-10-15. Never invent or change contact details without him.
- Credits must be sourced (NewscastStudio, TV Technology) or come from the family photo archive (including `raw/archive-2016`). Don't add unverified credits or guess years.
- `raw/` holds original photos and is gitignored; `npm run assets` builds new or changed images into `public/shows/` and `src/data/assets.json`.
- Domain is fullertonproductions.ca (moving to Cloudflare later).
