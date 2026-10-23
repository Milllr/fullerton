# Fullerton Productions

Portfolio site for James Downey, Lighting Designer, and his company Fullerton Productions (Toronto).

One sheet of warm paper, warmed wherever you go (the `tungsten` rebuild, October 2026). The look comes from late 1990s and early 2000s tech print (grainy warm gradients, out of focus light, small precise type, crop marks and numbered timelines): highly minimal, with the interaction in the warmth itself. The earlier dark stage site (Vectorworks drawings, grandMA3 desk) is in the history up to commit 08df3b7.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve dist/ locally
```

Node 20 or newer. main deploys to Cloudflare Pages production (https://fullerton-b9y.pages.dev); every other branch push gets a preview at `<branch>.fullerton-b9y.pages.dev`.

## What's where

| Path | What it is |
| --- | --- |
| `src/data/shows.ts` | Every show, its photos, and every credit with its source |
| `src/data/site.ts` | Name, role, city, email and phone |
| `src/brand/` | His logo, traced to SVG: the bulb in sunglasses and the script wordmark |
| `src/light/warmth.ts` | The warmth the pointer (or a finger) leaves on the paper, and how it cools |
| `src/light/field.ts` | The page itself: paper, the 2000s gradient, the warmth and film grain, in one WebGL shader |
| `src/light/tungsten.ts` | A tungsten filament: thermal lag and the black body colour, for everything that comes up like a lamp |
| `src/work/showcase.ts` | The pinned showcase: every show as a plate in a stack you scroll through |
| `src/work/list.ts` | All of his work in one list |
| `src/work/sheet.ts` | A show opened: the photo under frost, the frost edge you can drag, warmth that melts it |
| `src/cable/cable.ts` | The scrollbar: a DMX cable that coils over/under as you scroll |
| `src/styles.css` | All of the styling |
| `public/shows/<show>/` | Web photos (`.webp`, `-m.webp`) |
| `tools/` | The image pipeline (Python) and the single page preview build |

## The warmth

The paper is a slow 2000s gradient: warm cream with soft fields of amber, a grey teal and a little burnt brown, drifting very slowly and shifting as the page scrolls. Wherever the pointer goes it warms in a wide radius and keeps the heat a while. On a phone a touch blooms, a held finger keeps heating where it rests, and dragging or scrolling leaves a trail. The page breathes a little warmth as it opens, so it shows what it does before anyone moves.

The heat cools the way a tungsten filament does, quickly at first and then a long amber tail: hot reads as a pale warm white, cooling deepens to amber. It belongs to the paper, so it scrolls away with the page. It lives in a coarse grid (`src/light/warmth.ts`) that the shader reads as a texture.

**The window gobo.** On the cover, late light falls through a window across the paper, the way an LD throws a window gobo onto a set: a skewed patch of warm light in six panes, the glazing bars going softer further from the window, the edges running a little warmer, and leaves drifting slowly through it. The pointer (or a finger on a phone) casts a soft shadow where it passes through the light. It drifts very slowly, like the sun moving, and scrolls away with the cover.

The networks along the foot of the cover are links: hover one and a print of its first show comes up above the pointer; click it and the page glides to that show in the showcase.

Without WebGL the warmth still follows, as a plain CSS gradient.

## The work

**Showcase.** Every show is a plate of frosted glass in a stack receding in depth, pinned while the page scrolls through it. Scrolling draws the stack forward one plate at a time, and when the page stops it settles on the nearest. The plate in front comes up out of the frost on the tungsten curve (dim and amber first, then clear) and, while it's held there, steps through that show's photos. Beside it: the number, title, network, year and kind, and View the show, a link on a hairline. Hover a plate behind and it warms and lifts, with its name at the pointer; click it to bring it forward. Click the front plate (the pointer says View the show) or the link to open the show. The numbered rules along the foot jump to any show, and a hairline arrow at the bottom right glides past them all to All work.

**All work.** Under the showcase, every production in one list, newest first, the year once per year: production, network and kind. The whole row is the link: shows with photos open their sheet, and the rest open their source. On a pointer, a print of the show comes up above the pointer, so the row stays readable.

**A show.** Its photo fills the window with a sheet of frost over part of it and the type on the frost: title, network, kind, source, any note, the years set large, and the photos numbered along the bottom. The frost edge leans a little towards the pointer, and the warmth melts the frost wherever it's been (never all the way, so the type stays readable). Click the left of the window for the previous photo and anywhere else for the next; a small label at the pointer says which. The arrow keys work too. On a phone, swipe sideways between photos, tap to go on, and drag up or down to move the frost edge. Nothing in the sheet can be selected or dragged. Smaller photos and ones far from the window's shape sit whole in the clear part. Each new photo comes up like a lamp while the last one stays under it, so there's no dip.

## The cable

The scrollbar is a DMX cable down the right edge. Its male five pin XLR is where you are on the page; the cable hangs from it to the floor, and the slack is coiled there over/under: the over loops lie in the outer row, every other loop is turned and lies in the inner row with its sheen rolling once across the cable, and the crossing into each loop goes over the bundle for an over loop and under it for an under loop, so the crossings along the front alternate like a braid. The far end lies out on the floor with its female connector. At the top of the page the cable is out at full length; scroll down and the connector comes down with you while the cable is laid into the coil loop by loop, the newest loop sweeping round, lifting over the pile into the hang. A quick move sets the hang swinging a little. Drag the connector to scroll. The native scrollbar is hidden; wheel, keys and touch scroll as normal.

## Browsers and devices

- The address only ever holds an open show (`#/work/<show>`). The nav, skip link and brand scroll without changing it, so Back from a show never jumps the page to an old section.
- The shader canvas is sized to the large viewport, so a phone's address bar showing or hiding doesn't resize it. A lost WebGL context is handled.
- The show sheet makes the page behind it inert, keeps the keys working after a click, and returns focus to the link it was opened from.
- `prefers-reduced-motion` drops the grain's movement, the opening breath and every spring: everything lands where it's going at once.
- The plates reach past the edge of the window; `main` clips them (`overflow-x: clip`, which keeps the pinning working) so phones don't scroll sideways.

In development `window.__tungsten` holds the warmth, showcase, sheet and cable for tests.

## Adding or changing photos

Originals live in `raw/` (ignored by git, they're large). Add the file to `raw/` and an entry to `tools/manifest.json`, then:

```bash
pip install pillow
npm run assets       # builds what's new or changed; --force rebuilds everything
```

Then add the show to `src/data/shows.ts` (the `images` come from `src/data/assets.json`, which the pipeline writes).

## Credits and sources

Accepted sources (Miller, 2026-10-22): NewscastStudio, TV Technology, James's own site (2016 in the Wayback Machine, and as it was in 2026), the family photo archive, and his IMDb credits. The list in `src/data/shows.ts` combines:

- NewscastStudio set galleries credited "Lighting Design: James Downey / Fullerton Productions" (Sportsnet Studios 2021, Breakfast Television 2017, Hockey Central 2014, Sportsnet 360 and Sportsnet 2013)
- His 2018 NewscastStudio interview and 2022 TV Technology article (Super Bowl XLIV, TED, Hockey Night in Canada, Gemini and Genie Awards, the 2011 Royal Wedding, two dozen plus Rogers studios)
- The family photo archive, with years from the photo metadata (MMVAs 2012, ET Canada 2008 to 2014, TIFF 2007, events 2005 to 2009)
- His 2016 site (`raw/archive-2016`, linked in the Wayback Machine as the source): ET Canada New Year's Eve, Gemini Awards, Global Ottawa studio, Hockey Night in Canada, the Lord of the Rings exhibit, Sportsnet Studios 1 and 3, The Ron James Show and The Score. Years from the sets themselves where they show one (Gemini Awards 08, the New Year's countdown to 2012).
- His site as it was in 2026 (`raw/site-2026`): TED, Fire Masters, The Big Bake, and more Hockey Central, Super Bowl and Sportsnet Studio 1 photos.
- His IMDb credits (nm2333234).

Breakfast Television and Sportsnet Studios photos are by Arash Moallemi (credited on each photo).

## The logo

`src/brand/logo-mark.svg` and `logo-word.svg` are traced from his logo (potrace, from the image on his old site), filled with `currentColor` so the page can colour them. The mark is in the header and the site icon (`public/favicon.svg`); mark and wordmark together sign off the Contact section.

## Deploying

It's a static site: `npm run build` and publish `dist/`. Cloudflare Pages works with build command `npm run build` and output directory `dist`.

`node tools/artifact.mjs` builds `dist-artifact/artifact.html` with the JS and CSS inlined and the fonts from Google Fonts, with the photos next to it, for hosting as a single page.
