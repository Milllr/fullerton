# Fullerton Productions

Portfolio site for James Downey, Lighting Designer, and his company Fullerton Productions (Toronto).

This is the `tungsten` rebuild: one sheet of warm paper lit by one tungsten lamp. The look comes from late 1990s and early 2000s tech print (grainy warm gradients, out of focus light, small precise type, crop marks, contour lines and numbered timelines): highly minimal, with the interaction in the light itself. The earlier dark stage site (Vectorworks drawings, grandMA3 desk) is on `main`.

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
| `src/lamp/tungsten.ts` | The filament: thermal lag, colour temperature and light output on the dimmer |
| `src/lamp/lamp.ts` | The bulb drawing, the dimmer you drag, the swing, flying in and out, the readout and contour labels |
| `src/lamp/field.ts` | The page itself: paper, the lamp's light and colour, isolux contours and film grain, in one WebGL shader |
| `src/work/deck.ts` | The work index and the stack of frosted plates beside it |
| `src/work/sheet.ts` | A show opened: the photo half under frost, the frost edge you can drag |
| `src/work/credits.ts` | The credits list |
| `src/styles.css` | All of the styling |
| `public/shows/<show>/` | Web photos (`.webp`, `-m.webp`) |
| `tools/` | The image pipeline (Python) and the single page preview build |

## The lamp

A clear tungsten bulb in a pendant lampholder hangs on its flex from the top of the window. It's channel 1, and it lights the whole page.

- **Dim it**: drag it up or down, or focus it and use the arrow keys (Page Up and Down for bigger steps, Home and End for out and full). It's a slider to a screen reader.
- **Switch it**: tap it, or press Enter or Space. Off, the page goes to a cool blue hour grey; on, it comes back up.
- **Brush past it** and it swings, settling like a pendulum on its flex.
- **Flying**: over the cover it hangs low; scroll on and it's flown out to the top so its light spreads into an even wash to read by (on a phone it goes right out of sight); over the contact details it comes partway back down.
- **Cues**: it comes up from cold when the page opens (2.6 s), goes out while a show is open and comes back when it closes.
- **Readout**: beside the glass, the channel at its level the way a desk shows it (`FL` at full) and the filament's actual colour temperature as it moves.

### How the filament behaves

`src/lamp/tungsten.ts` models the filament rather than fading a colour, so it behaves the way an LD knows tungsten does:

- The fader sets the voltage. The filament heats by Joule heating and cools by radiation (T to the fourth), so it comes up quickly and dies away slowly: switched off it drops at once and then glows red for a moment.
- At rest T goes as V^0.4, the textbook law for tungsten colour temperature, so dimming runs down the black body curve: 2900 K at full, amber at half, orange, then a deep red ember before it goes out. Output goes as V^3.4, so half the voltage gives about a tenth of the light.

### How the light falls

`src/lamp/field.ts` draws the paper:

- **Paper and room**: warm paper while the lamp is up, cool grey and dimmer towards the corners when it's down.
- **The lamp's colour** soaks into the paper around it, richer and browner as it dims; right under it the pool lifts the paper towards a warm white.
- **The filament out of focus**: a hot core and halo on the bulb.
- **Isolux contours**: the photometric plot of the same light (inverse square with the cosine, from the lamp's height), drawn as hairline rings at 1000, 500, 200, 100, 50, 20 and 10 lx and labelled along a bearing like contours on a map, the decade rings heavier. Dim the lamp and they close in and vanish one by one; fly it out and they spread.
- **Film grain** over all of it, a new frame 24 times a second.

Without WebGL the page falls back to a CSS gradient from the same lamp colour and position.

## The work

The index is set like the track list on a sleeve: number, show, network, year, with hairline column rules. Beside it every show is a plate of frosted glass in a stack receding in depth. Point at a show (or focus it; on a phone, scroll it to the reading line) and the stack slides through to its plate, which comes up out of the frost on the same tungsten curve: dim and amber first, then clear. The plate it leaves cools back into the frost.

Click a show (or the front plate) to open it. Its photo fills the window with a sheet of frost over part of it and the type on the frost: title, network, kind, source, the years set large, and the photos numbered along the bottom. The frost edge leans a little towards the pointer and can be dragged across the photo; tap the clear side for the next photo, or use the arrow keys. Photos far from the window's shape sit whole in the clear part with their own frost around them. Each new photo comes up like a lamp while the last one stays under it, so there's no dip.

## Browsers and devices

- The address only ever holds an open show (`#/work/<show>`). The nav, skip link and brand scroll without changing it, so Back from a show never jumps the page to an old section.
- The shader canvas is sized to the large viewport, so a phone's address bar showing or hiding doesn't resize it. A lost WebGL context is handled.
- The show sheet makes the page behind it inert, keeps the keys working after a click, and returns focus to the link it was opened from.
- `prefers-reduced-motion` drops the opening cue, the swing, the grain's movement and every spring: everything lands where it's going at once.
- On a phone the plates stay at the top of the work list behind frost while the list scrolls under them, and the sheet's frost runs across the top with the edge moving up and down.

In development `window.__tungsten` holds the lamp, deck and sheet for tests (`__tungsten.lamp.fader.set(0.5)`).

## Adding or changing photos

Originals live in `raw/` (ignored by git, they're large). Add the file to `raw/` and an entry to `tools/manifest.json`, then:

```bash
pip install pillow
npm run assets       # builds what's new or changed; --force rebuilds everything
```

Then add the show to `src/data/shows.ts` (the `images` come from `src/data/assets.json`, which the pipeline writes).

## Credits and sources

The credits list in `src/data/shows.ts` combines:

- NewscastStudio set galleries credited "Lighting Design: James Downey / Fullerton Productions" (Sportsnet Studios 2021, Breakfast Television 2017, Hockey Central 2014, Sportsnet 360 and Sportsnet 2013)
- His 2018 NewscastStudio interview and 2022 TV Technology article (Super Bowl XLIV, TED, Hockey Night in Canada, Gemini and Genie Awards, the 2011 Royal Wedding, two dozen plus Rogers studios)
- The family photo archive, with years from the photo metadata (MMVAs 2012, ET Canada 2008 to 2014, TIFF 2007, events 2005 to 2009)
- The 2016 archive (`raw/archive-2016`): ET Canada New Year's Eve, Gemini Awards, Global Ottawa studio, Hockey Night in Canada, the Lord of the Rings exhibition, Sportsnet Studios 1 and 3, The Ron James Show and theScore, plus more photos of ET Canada, the MMVAs and Sportsnet 360. Those photos carry no dates, so these shows have no year.

Breakfast Television and Sportsnet Studios photos are by Arash Moallemi (credited in the footer and on each photo).

## Deploying

It's a static site: `npm run build` and publish `dist/`. Cloudflare Pages works with build command `npm run build` and output directory `dist`.

`node tools/artifact.mjs` builds `dist-artifact/artifact.html` with the JS and CSS inlined and the fonts from Google Fonts, with the photos next to it, for hosting as a single page.
