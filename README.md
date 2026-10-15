# Fullerton Productions

Portfolio site for James Downey, Lighting Designer, and his company Fullerton Productions (Toronto).

The site is a dark stage drawn the way Vectorworks Spotlight draws on its black background. Every show is a sheet: its set as a Hidden Line render traced from his photos, inside a title block border with Spotlight drafting. A small rig hangs off the truss at the top of the page and lights it up: two moving head spots at the wings that cross their beams, and two soft LED panels inside them pointing straight down. Wherever the light lands, the real photograph shows through.

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
| `src/data/site.ts` | Name, role, city, email and phone |
| `src/engine/rig.ts` | The spots (pan and tilt on a damped spring, pool geometry) and the panels' fixed fields |
| `src/engine/fixture.ts` | The spots and panels drawn as 3D wireframes |
| `src/engine/shaft.ts` | WebGL beams through haze, floor pools, spill and lens glow, for all four lights |
| `src/engine/plate.ts` | Sketch rendering, the photo reveal in each spot's pool, and the panels' flood |
| `src/engine/gobos.ts` | Gobo masks (open, breakup, dots, ring) |
| `src/desk/` | The grandMA style desk: model, command line, hardware UI |
| `src/ui/detail.ts` | The show sheet with every photo |
| `src/ui/credits.ts` | The sortable credits list |
| `public/shows/<show>/` | Web photos (`.webp`, `-m.webp`) and traced sketches (`.json`) |
| `tools/` | The asset pipeline (Python) |

## Contact details

`src/data/site.ts` holds James's email and phone, confirmed by Miller. They show in the Contact section as outlined type that lights up under the beams; the phone shows spaced (no dashes) and dials as `+14168821379`. If a field is ever emptied it's hidden on the built site (and `npm run dev` shows a reminder).

## Adding or changing photos

Originals live in `raw/` (ignored by git, they're large). The pipeline makes the web images and traces the sketches:

```bash
pip install opencv-python pillow numpy
# add the file to raw/ and an entry to tools/manifest.json, then
npm run assets                       # everything
python tools/build_assets.py --sketch-only   # just re-trace sketches
```

Then add the show to `src/data/shows.ts` (the `images` come from `src/data/assets.json`, which the pipeline writes).

The tracer (`tools/sketch.py`) finds straight edges with OpenCV's line segment detector, merges collinear pieces, keeps curved outlines for people and round sets, and turns small bright light sources into fixture symbols. Then `tools/hiddenline.py` cleans each trace so it reads as a Hidden Line render, which only ever draws model geometry: it drops specks, cuts reflections below the floor line, and clears LED wall video, haze beams, crowds and floorboards using per photo rules at the top of the file. Add a rule there when you add a key photo.

## The drawings

Built to Vectorworks Spotlight defaults and USITT practice so an LD reads them as Vectorworks on sight. The labels are placeholders in Vectorworks' default style, not James's own paperwork.

- **Black background, white lines**, as Vectorworks shows a black pen with its black background preference. Unlit, a drawing sits back like a greyed layer; under the light it goes full white.
- **Sets** are Hidden Line renders: one even line weight, no hand drawn overshoot, only model edges.
- **The rig** is Hidden Line solids: faces filled black, back faces culled, the round heads showing only rims and silhouette. Each unit carries its unit number on the body and its channel (the desk's fixture number) in a circle in front. The position is labelled at its end: TRUSS 1, TRIM 6500. The hazer, channel 5, sits on the hero's deck.
- **Every sheet** has a title block border (thin outer line, heavy inner line, numbered and lettered grid zones), a centre line with the CL mark, a Vectorworks drawing label (1 over LX1, PERSPECTIVE on a heavy rule, SCALE: NTS) and a title block bottom right with the production, drawing, lighting designer, client, scale, date and sheet. Perspectives aren't to scale, so they say NTS; there's no scale bar or dimension on them. The hero's title block is a strip in HTML with the same fields (and a link to the show).
- **Draw Beam**: each spot's beam is drawn as a wireframe cone from the lens to its field ellipse, with the beam angle dashed inside, cropped to the sheet it lands on. A focus point (Vectorworks' octagon with a locus) sits where each beam is aimed: FP1, and FP2 when the spots cross to different points.

## The desk

The controls are a pull-up lighting desk modelled on grandMA3. The bar along the bottom holds the command line and the live encoder readouts; **Desk** pulls up the rest.

- **Fixtures**: 1 Spot L and 2 Spot R are the moving heads, 3 Panel L and 4 Panel R the soft panels (Dimmer and Color Temp only), 5 the hazer. The spots are selected to begin with, so the encoders drive both. Selected fixtures read yellow.
- **Feature groups and encoders**: Dimmer, Position, Gobo, Color, Beam, Focus and Control page five endless encoders (drag, scroll or arrow keys; press to toggle Fine). Values go into the programmer and show red; playback values show cyan.
- **Programmer**: values hold until Clear. Clear works in three stages like the desk (deselect, deactivate, release); hold it for a full clear. Oops undoes, Highlight brings the head to open white, Blind hides the programmer from the output (the page gets a red frame), Store saves the programmer as a new cue.
- **Executors**: Exec 1 runs Sequence 1, where each cue is a show and both spots cross on it (Go+, Go-, Pause, fade times). Exec 2 is the hazer master, Exec 3 a pan and tilt sweep phaser that mirrors the two spots so they cross, Exec 4 the Fill master for the panels. On a desktop Sweep comes up by itself after six idle seconds and drops when you move; on a touch screen Fill comes up by itself to 72% once the rig is lit. Grand Master and B.O. sit over everything. Faders are motorised: commands move them.
- **Preset pools**: 1 Dimmer, 2 Position (one per show; with both spots selected they cross on it), 3 Gobo, 4 Color, 5 Beam, 6 Focus.
- **Command line**: real grandMA syntax, keywords can be shortened. `Fixture 1 Thru 2 At 75`, `Fixture 3 + 4 At 60`, `Fi 5 At 80`, `Attribute "Zoom" At 30`, `Preset 4.2`, `Go`, `Go-`, `Goto Cue 3`, `Pause`, `Off`, `Executor 3 At 60`, `Executor 4 At 70`, `Store Cue 12 "My look"`, `Clear`, `ClearAll`, `Oops`, `Highlight`, `Blind`, `Help`. The keys type into it and Please runs it.

With nothing running and nothing programmed, both spots converge on the cursor and the panels stay off until Fill is raised. On a touch screen the panels come up as a fill, so whichever show is in the middle of the screen is lit as you scroll; the spots cross on that show and roam slowly over it. A finger on the page pulls both spots onto it, and they go back to roaming a moment after it lifts. Keyboard focus on a show swings the beams onto it; clicking a show opens them wide on it and then opens every photo. `prefers-reduced-motion` turns off the opening cue, sweep, roam, haze drift, strobe and transitions.

## How the light behaves

The light is meant to read like a real rig on a black stage:

- **Pool**: hottest in the middle and falling off towards the field edge before the focus edge cuts it. Focus and Frost on the desk soften the edge and the gobo.
- **Throw**: aiming further away spreads the same light thinner, so a long throw is dimmer and wider.
- **Spill**: past the pool the light fades out slowly, so the real photo shows faintly well beyond the beam, and the floor around it glows.
- **Floor pool**: where the beam lands on bare stage, the pool carries the same gobo pattern as on the photos.
- **Crossing**: where the two spots' pools overlap they add up the way light does (screened, so the overlap is brighter but never clips).
- **Panels**: each throws a broad, even field that softens towards its edge, so the show in the middle of the screen is fully lit and the ones above and below fall away. As a show comes into the field the sketch eases back and the photo comes up. On bare stage the field is only a faint wash.
- **Bounce**: the set under the brightest pool reflects its own colour back onto the surroundings, tinted by that spot's colour.
- **Haze**: the shaft scatters a dim glow around itself; the Hazer fixture's Haze and Fan set how much and how fast it drifts.
- **Lines and type** near the beam catch light with a long, faint tail.
- **The desk**: when a light reaches low on the page, the desk's front lip and nearest keys pick up a little of it.

## Browsers and devices

Checked on phone, tablet, laptop and large screen sizes, with touch and mouse, without WebGL, and with reduced motion. Things that keep it working everywhere:

- The address only ever holds an open show (`#/work/<show>`). The nav, skip link and brand scroll without changing it, so Back from a show never jumps the page to an old section.
- Photos load when a plate comes near, not through the browser's lazy loading (Firefox won't fetch a lazy image for `decode()`); a failed sketch download is retried rather than remembered.
- A phone's address bar showing or hiding doesn't rebuild the rig or redraw the sketches; only width or pixel ratio changes do.
- Frame work reads layout first and writes after, and only writes CSS variables that changed.
- The beams survive a lost WebGL context (iOS drops it in background tabs); without WebGL the beams and haze are simply absent and the photos still light.
- Safari without canvas filters still gets soft gobos; Safari before 17.4 gets faders turned on their side (it can't draw vertical sliders).
- If the script never runs, the photos show plainly.
- The show sheet makes the page behind it inert, keeps the keys working after a click, and returns focus to the link it was opened from.

## Hosted preview

In development, `?fast` renders the haze coarsely and takes bigger time steps, which makes headless screenshot tests usable; it does nothing in a build.

`node tools/artifact.mjs` builds `dist-artifact/artifact.html` with the JS and CSS inlined and fonts from Google Fonts, plus the photos next to it, for hosting as a single page.

## Credits and sources

The credits list in `src/data/shows.ts` combines:

- NewscastStudio set galleries credited "Lighting Design: James Downey / Fullerton Productions" (Sportsnet Studios 2021, Breakfast Television 2017, Hockey Central 2014, Sportsnet 360 and Sportsnet 2013)
- His 2018 NewscastStudio interview and 2022 TV Technology article (Super Bowl XLIV, TED, Hockey Night in Canada, Gemini and Genie Awards, the 2011 Royal Wedding, two dozen plus Rogers studios)
- The family photo archive, with years from the photo metadata (MMVAs 2012, ET Canada 2008 to 2014, TIFF 2007, events 2005 to 2009)

Breakfast Television and Sportsnet Studios photos are by Arash Moallemi (credited in the footer and on each photo).

## Deploying

It's a static site: `npm run build` and publish `dist/`. Cloudflare Pages works with build command `npm run build` and output directory `dist`.
