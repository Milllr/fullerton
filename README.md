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
| `src/light/gobo.ts` | The cover's gobo wheel: when it turns to the next gobo, and its focus |
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

**The gobo.** On the cover a profile spot off to the upper right throws a gobo across the paper. Its round beam lands keystoned, the far side wider, a little dimmer and softer than the near, with the faint colour fringes a real lens gives its edges. The fixture's wheel holds four steel gobos: a window of six panes, a leaf breakup that turns slowly, venetian blinds and leaded diamond panes. A second after the page opens the wheel turns to the next, and then every 6.75 seconds while the cover is in view, in the open, the way a moving light does: the gobo slides out of the gate on the wheel's arc, a sliver of the wheel's own steel crosses, and the next slides in, the focus going soft as it moves and coming back sharp just after it lands (`src/light/gobo.ts`; the gobos are drawn in the shader, `src/light/field.ts`). The pointer (or a finger on a phone) casts a soft shadow where it passes through the beam, and the light scrolls away with the cover. With reduced motion the wheel stays on the window.

The networks along the foot of the cover are links: hover one and a print of its first show comes up above the pointer; click it and the page glides to that show in the showcase.

Without WebGL the warmth still follows, as a plain CSS gradient.

## The work

**Showcase.** Every show is a plate of frosted glass in a stack receding in depth, pinned while the page scrolls through it. Scrolling draws the stack forward one plate at a time, and when the page stops it settles on the nearest. The plate in front comes up out of the frost on the tungsten curve (dim and amber first, then clear) and, while it's held there, steps through that show's photos. Beside it: the number, title, network, year and kind, and View the show, a link on a hairline. Hover a plate behind and it warms and lifts, with its name at the pointer; click it to bring it forward. The words at the pointer have no box: they sit in a soft pool of frost, eased away to nothing at its edges, that mists up as they come and clears as they go, trails the pointer a touch, and fades across when the name changes. Click the front plate (the pointer says View the show) or the link to open the show. The numbered rules along the foot jump to any show, and a hairline arrow at the bottom right glides past them all to All work.

**All work.** Under the showcase, every production in one list, newest first, the year once per year: production, network and kind. The whole row is the link: shows with photos open their sheet, and the rest open their source. On a pointer, a print of the show comes up above the pointer, so the row stays readable.

**A show.** Its photo fills the window with a sheet of frost over part of it and the type on the frost: title, network, kind, any note, the years set large, and the photos numbered along the bottom (the sources stay in the data, not on the page). Close is just the word, with a hairline that draws in under it on hover and room round it for a thumb. The sheet itself takes focus as it opens, so the keys work and no ring is drawn round Close. The frost edge leans a little towards the pointer, and the warmth melts the frost wherever it's been (never all the way, so the type stays readable). Click the left of the window for the previous photo and anywhere else for the next; the pointer turns into a quiet hairline arrow showing which. The arrow keys work too. Photos dissolve into each other over about 1.3 seconds, the new one settling from a touch closer; every layer of it (photo, frost, background) is ready before it starts, and the photos either side are fetched ahead, so a click answers at once and nothing pops in. On a phone, swipe sideways between photos, tap to go on, and drag up or down to move the frost edge. Nothing in the sheet can be selected or dragged. Smaller photos and ones far from the window's shape sit whole in the clear part.

**A film.** A show can have a film (`film` in `src/data/shows.ts`, a YouTube id). It comes after the photos, with Video at the end of the numbers and Watch beside the running time in the type. Until it's played it's one of the show's own photos at the film's shape, whole and clear of the frost, with a hairline play mark (and the pointer turns into one). Click or tap it, or Watch, and the player loads over it (youtube-nocookie, nothing from YouTube loads before that). Moving to a photo or closing the show stops it. Sportsnet Studios has Sportsnet's own tour of the studios, the one James asked for.

## The cable

The scrollbar is a DMX cable down the right edge. Its male five pin XLR is where you are on the page; the cable hangs from it straight down to the floor, where the slack is coiled over/under, the way it's done on a gig. The coil lies just left of the cable, every loop gathered at the side the cable comes down to, so the hang never has to reach across it. Loops go onto the pile whole, one at a time. An over loop opens out of the foot of the cable and tips back onto the pile. An under loop is made the other way round: it opens flat on the floor in front and is turned over onto the pile, the way your wrist turns over for it, so it lies the same way round as the rest with its crossing underneath. Over and under loops lie turned slightly against each other, so they cross at the gather and fan a little at the far side, like a real coil. The far end runs in along the front of the first loop and lies out to the left with its female connector. At the top of the page one loop is down; scroll down and the connector comes down with you while a loop is laid for each stretch of cable (nine by the bottom), and scroll back up and they come back off. The hang is simulated (a chain of points under gravity with a little stiffness, held straight out of the connector's boot and out of the coil), so a fast scroll leaves it swaying and it settles by itself. It's 3D underneath: each loop is a circle on the floor, turned up about its front edge while it's in the air, and projected. Drag the connector to scroll. The native scrollbar is hidden; wheel, keys and touch scroll as normal.

## Browsers and devices

- The address only ever holds an open show (`#/work/<show>`). The nav, skip link and brand scroll without changing it, so Back from a show never jumps the page to an old section.
- The shader canvas is sized to the large viewport, so a phone's address bar showing or hiding doesn't resize it. A lost WebGL context is handled.
- Scrolling stays light on big screens and integrated graphics. What scrolling changes every frame is never written as a custom property on a plate: Chrome repaints the whole element when one of its custom properties changes, even if nothing it draws does, and a plate's repaint is its blurred photo, blend layers and shadow. So each plate's fade is its own `opacity`, and its haze is a layer of its own (`will-change: opacity`) whose opacity is set directly. Plates are stacked by their place in the order rather than by a depth number, so a plate's z-index only changes when two plates really swap. Measured on an Iris Xe at 3456 by 2160, fast scrolling through the showcase: GPU raster from about 20ms a frame to about 8, style recalculation from about 9ms to 4, with the same pixels (grain aside).
- The show sheet makes the page behind it inert, keeps the keys working after a click, and returns focus to the link it was opened from.
- `prefers-reduced-motion` drops the grain's movement, the opening breath and every spring: everything lands where it's going at once.
- The plates reach past the edge of the window; `main` clips them (`overflow-x: clip`, which keeps the pinning working) so phones don't scroll sideways.

In development `window.__tungsten` holds the warmth, showcase, sheet and cable for tests.

## Adding or changing photos

Originals live in `raw/` (ignored by git, they're large). James shares his on Dropbox (Photos For Miller, one folder per show), and `raw/` keeps the same folders. Add the file to `raw/` and an entry to `tools/manifest.json`, then:

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
- The show folders James shares on Dropbox, which say which show each photo is from: Gerry Dee Live (his CBC New Year's special; recorded at the Centrepointe Theatre and aired December 31, 2013, per the CBC media centre) and more Hockey Night in Canada
- His 2016 site (`raw/archive-2016`, linked in the Wayback Machine as the source): ET Canada New Year's Eve, Gemini Awards, Global Ottawa studio, Hockey Night in Canada, the Lord of the Rings exhibit, Sportsnet Studios 1 and 3, The Ron James Show and The Score. Years from the sets themselves where they show one (Gemini Awards 08, the New Year's countdown to 2012).
- His site as it was in 2026 (`raw/site-2026`): TED, Fire Masters, The Big Bake, and more Hockey Central, Super Bowl and Sportsnet Studio 1 photos.
- His IMDb credits (nm2333234).

Breakfast Television and Sportsnet Studios photos are by Arash Moallemi (credited on each photo).

## The logo

`src/brand/logo-mark.svg` and `logo-word.svg` are traced from his logo (potrace, from the image on his old site), filled with `currentColor` so the page can colour them. The mark is in the header and the site icon (`public/favicon.svg`); mark and wordmark together sign off the Contact section.

At Contact the shades catch the light (`src/brand/glint.ts`): the window from the cover shows as a small reflection in the sunglasses, one in each lens (narrower in the far one, seen side on), clipped to the lenses' own ink. It slides across them against the pointer, the way a reflection moves in a curved lens; on a phone, or with the pointer gone, it slides as the page comes down to Contact. It comes up on the tungsten curve when Contact comes into view (dim and amber, then clear) and brightens a touch as the pointer comes near. With reduced motion it sits still, lit.

## Deploying

It's a static site: `npm run build` and publish `dist/`. Cloudflare Pages works with build command `npm run build` and output directory `dist`.

`node tools/artifact.mjs` builds `dist-artifact/artifact.html` with the JS and CSS inlined and the fonts from Google Fonts, with the photos next to it, for hosting as a single page.
