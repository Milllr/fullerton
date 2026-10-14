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

## The desk

The controls are a pull-up lighting desk modelled on grandMA3. The bar along the bottom holds the command line and the live encoder readouts; **Desk** pulls up the rest.

- **Fixtures**: Fixture 1 is the moving head, Fixture 2 the hazer. Selected fixtures read yellow.
- **Feature groups and encoders**: Dimmer, Position, Gobo, Color, Beam, Focus and Control page five endless encoders (drag, scroll or arrow keys; press to toggle Fine). Values go into the programmer and show red; playback values show cyan.
- **Programmer**: values hold until Clear. Clear works in three stages like the desk (deselect, deactivate, release); hold it for a full clear. Oops undoes, Highlight brings the head to open white, Blind hides the programmer from the output (the page gets a red frame), Store saves the programmer as a new cue.
- **Executors**: Exec 1 runs Sequence 1, where each cue is a show (Go+, Go-, Pause, fade times). Exec 2 is the hazer master, Exec 3 a pan and tilt sweep phaser. The Sweep fader comes up by itself after six idle seconds and drops when you move. Grand Master and B.O. sit over everything. Faders are motorised: commands move them.
- **Preset pools**: 1 Dimmer, 2 Position (one per show), 3 Gobo, 4 Color, 5 Beam, 6 Focus.
- **Command line**: real grandMA syntax, keywords can be shortened. `Fixture 1 At 50`, `Fi 2 At 80`, `Attribute "Zoom" At 30`, `Preset 4.2`, `Go`, `Go-`, `Goto Cue 3`, `Pause`, `Off`, `Executor 3 At 60`, `Store Cue 12 "My look"`, `Clear`, `ClearAll`, `Oops`, `Highlight`, `Blind`, `Help`. The keys type into it and Please runs it.

With nothing running and nothing programmed, the head follows the cursor. Keyboard focus on a show swings the beam onto it; clicking a show opens the beam wide on it and then opens every photo. `prefers-reduced-motion` turns off the opening cue, sweep, haze drift, strobe and transitions.

## Versions A and B

There are two directions while the design is being chosen, switched with the A/B control at the top left (remembered per browser):

- **A**: the desk and the header are industrial; the rest of the site keeps its quieter look.
- **B**: the whole site goes industrial: rack rails, a condensed engraved wordmark and nameplate, shows in multiviewer tiles with under-monitor labels and tally lights that go red when the beam is on them, and the credits as a desk sheet.

Version B lives in `src/skin-b.css` under `[data-skin='b']`. Once one is picked, delete the other and the switch.

## Hosted preview

`node tools/artifact.mjs` builds `dist-artifact/artifact.html` with the JS and CSS inlined and fonts from Google Fonts, plus the photos next to it, for hosting as a single page.

## Credits and sources

The credits list in `src/data/shows.ts` combines:

- NewscastStudio set galleries credited "Lighting Design: James Downey / Fullerton Productions" (Sportsnet Studios 2021, Breakfast Television 2017, Hockey Central 2014, Sportsnet 360 and Sportsnet 2013)
- His 2018 NewscastStudio interview and 2022 TV Technology article (Super Bowl XLIV, TED, Hockey Night in Canada, Gemini and Genie Awards, the 2011 Royal Wedding, two dozen plus Rogers studios)
- The family photo archive, with years from the photo metadata (MMVAs 2012, ET Canada 2008 to 2014, TIFF 2007, events 2005 to 2009)

Breakfast Television and Sportsnet Studios photos are by Arash Moallemi (credited in the footer and on each photo).

## Deploying

It's a static site: `npm run build` and publish `dist/`. Cloudflare Pages works with build command `npm run build` and output directory `dist`.
