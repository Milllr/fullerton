# Fullerton Productions

Portfolio site for James Downey, Lighting Designer, and his company Fullerton Productions (Toronto).

The site is a dark stage. Every show is drawn as a hairline sketch traced from his photos, and one moving head hanging off the truss line at the top of the page lights it up. Wherever the beam lands, the real photograph shows through.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve dist/ locally
```

Node 20 or newer.

## What's where

| Path | What it is |
| --- | --- |
| `src/data/shows.ts` | Every show, its photos, and the full credits list with sources |
| `src/data/site.ts` | Name, role, city, **email and phone** (empty until confirmed) |
| `src/engine/rig.ts` | The moving head: pan and tilt on a damped spring, pool geometry |
| `src/engine/fixture.ts` | The fixture drawn as a 3D wireframe |
| `src/engine/shaft.ts` | WebGL beam through haze, spill and lens glow |
| `src/engine/plate.ts` | Sketch rendering and the photo reveal inside the pool |
| `src/engine/gobos.ts` | Gobo masks (open, breakup, dots, ring) |
| `src/ui/console.ts` | The fader wing: dimmer, zoom, colour, haze, gobo, Go |
| `src/ui/detail.ts` | The show sheet with every photo |
| `src/ui/credits.ts` | The sortable credits list |
| `public/shows/<show>/` | Web photos (`.webp`, `-m.webp`) and traced sketches (`.json`) |
| `tools/` | The asset pipeline (Python) |

## Contact details

`src/data/site.ts` has `email` and `phone` left empty on purpose. While they're empty the contact section is hidden on the built site (and shows a reminder in `npm run dev`). Fill them in and they appear as outlined type that lights up under the beam.

## Adding or changing photos

Originals live in `raw/` (ignored by git, they're large). The pipeline makes the web images and traces the sketches:

```bash
pip install opencv-python pillow numpy
# add the file to raw/ and an entry to tools/manifest.json, then
npm run assets                       # everything
python tools/build_assets.py --sketch-only   # just re-trace sketches
```

Then add the show to `src/data/shows.ts` (the `images` come from `src/data/assets.json`, which the pipeline writes).

The tracer (`tools/sketch.py`) finds straight edges with OpenCV's line segment detector, merges collinear pieces, keeps curved outlines for people and round sets, and turns small bright light sources into fixture symbols.

## Interaction

- The beam follows the cursor with weight and never snaps. After 6 seconds idle it drifts into a slow sweep (24 s across, 16 s up and down).
- Keyboard focus on a show swings the beam onto it.
- **Go** (or the `G` key, `Shift+G` for back) steps through the shows like a cue list.
- Clicking a show opens the beam wide on it, then opens every photo, each one brought up out of its sketch.
- On phones the beam sweeps on its own and follows your finger.
- `prefers-reduced-motion` turns off the opening cue, idle sweep, haze drift and transitions.

## Credits and sources

The credits list in `src/data/shows.ts` combines:

- NewscastStudio set galleries credited "Lighting Design: James Downey / Fullerton Productions" (Sportsnet Studios 2021, Breakfast Television 2017, Hockey Central 2014, Sportsnet 360 and Sportsnet 2013)
- His 2018 NewscastStudio interview and 2022 TV Technology article (Super Bowl XLIV, TED, Hockey Night in Canada, Gemini and Genie Awards, the 2011 Royal Wedding, two dozen plus Rogers studios)
- The family photo archive, with years from the photo metadata (MMVAs 2012, ET Canada 2008 to 2014, TIFF 2007, events 2005 to 2009)

Breakfast Television and Sportsnet Studios photos are by Arash Moallemi (credited in the footer and on each photo).

## Deploying

It's a static site: `npm run build` and publish `dist/`. Cloudflare Pages works with build command `npm run build` and output directory `dist`.
