import assets from './assets.json';

export interface ShowImage {
  id: string;
  w: number;
  h: number;
  credit?: string | null;
}

export interface Source {
  label: string;
  url: string;
}

/** A line under a credit, like an award nomination, with where it's confirmed. */
export interface Note {
  text: string;
  source?: Source;
}

export interface Show {
  slug: string;
  title: string;
  network: string;
  /** Display year, e.g. "2021" or "2008 to 2014". Empty when unknown. */
  year: string;
  /** Sort key for the credits list. 0 sorts to the end. */
  sortYear: number;
  kind: Kind;
  /** Image id used for the plate in the work list. */
  key: string;
  images: ShowImage[];
  source?: Source;
  note?: Note;
}

export type Kind = 'Studio' | 'Live broadcast' | 'Awards' | 'Festival' | 'Event' | 'Series';

export interface Credit {
  year: string;
  sortYear: number;
  production: string;
  network: string;
  kind: Kind;
  show?: string;
  source?: Source;
  note?: Note;
}

const A = assets as Record<string, ShowImage[]>;

const ncs = (path: string): Source => ({
  label: 'NewscastStudio',
  url: `https://www.newscaststudio.com/setstudio/${path}/`,
});

/** A page of James's own site as it was in 2016, kept by the Wayback Machine. */
const archived = (page: string): Source => ({
  // Lower case so the sheet reads "See it on his 2016 site"; the credits list capitalises it.
  label: 'his 2016 site',
  url: `https://web.archive.org/web/2016/http://fullertonproductions.ca/${page}`,
});

/** His IMDb credits (user edited; approved as a source by Miller, 2026-10-22). */
const imdb: Source = { label: 'IMDb', url: 'https://www.imdb.com/name/nm2333234/' };

const tvTech: Source = {
  label: 'TV Technology',
  url: 'https://www.tvtechnology.com/equipment/designing-tomorrows-tv-studio-from-the-ground-up-with-arri-lighting',
};

/** The hero plate. Also the first cue. */
export const hero: Show = {
  slug: 'sportsnet-studios',
  title: 'Sportsnet Studios 31 and 32',
  network: 'Sportsnet',
  year: '2021',
  sortYear: 2021,
  kind: 'Studio',
  key: 'studio-31',
  images: A['sportsnet-studios'],
  source: ncs('sportsnet-2'),
};

/** Work plates, in the order the Go button steps through them. */
export const shows: Show[] = [
  {
    slug: 'super-bowl-xliv',
    title: 'Super Bowl XLIV',
    network: 'CBS',
    year: '2010',
    sortYear: 2010,
    kind: 'Live broadcast',
    key: 'nfl-on-cbs',
    images: A['super-bowl-xliv'],
    source: archived('cbs-superbowl-xliv'),
  },
  {
    slug: 'mmvas',
    title: 'MuchMusic Video Awards',
    network: 'MuchMusic',
    year: '2012',
    sortYear: 2012,
    kind: 'Awards',
    key: 'queen-street',
    images: A['mmvas'],
    source: archived('much-music-video-awards'),
    note: {
      text: 'Canadian Screen Award nominee, 2013',
      source: { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/1st_Canadian_Screen_Awards' },
    },
  },
  {
    slug: 'hockey-night-in-canada',
    title: 'Hockey Central and Hockey Night in Canada studio',
    network: 'Sportsnet',
    year: '2014',
    sortYear: 2014,
    kind: 'Studio',
    key: 'arch',
    images: A['hockey-night-in-canada'],
    source: ncs('hockey-central'),
  },
  {
    slug: 'breakfast-television',
    title: 'Breakfast Television',
    network: 'City',
    year: '2017 to 2025',
    sortYear: 2017,
    kind: 'Studio',
    key: 'platform',
    images: A['breakfast-television'],
    source: ncs('breakfast-television'),
  },
  {
    slug: 'the-score',
    title: 'The Score',
    network: 'The Score Television Network',
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'desk',
    images: A['the-score'],
    source: archived('the-score'),
  },
  {
    slug: 'gemini-awards',
    title: 'Gemini Awards',
    network: 'Academy of Canadian Cinema and Television',
    // The year is on the set's own screens: "The Gemini Awards 08".
    year: '2008',
    sortYear: 2008,
    kind: 'Awards',
    key: 'stage',
    images: A['gemini-awards'],
    source: archived('gemini-awards'),
  },
  {
    slug: 'the-agenda',
    title: 'The Agenda with Steve Paikin',
    network: 'TVO',
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'set',
    images: A['the-agenda'],
  },
  {
    slug: 'et-canada',
    title: 'ET Canada',
    network: 'Global',
    year: '2008 to 2014',
    sortYear: 2008,
    kind: 'Series',
    key: 'casa-loma',
    images: A['et-canada'],
    source: archived('entertainment-tonight-canada'),
  },
  {
    slug: 'the-ron-james-show',
    title: 'The Ron James Show',
    network: 'CBC',
    year: '2009 to 2010',
    sortYear: 2009,
    kind: 'Series',
    key: 'set',
    images: A['the-ron-james-show'],
    source: archived('the-ron-james-show'),
  },
  {
    slug: 'sportsnet-360',
    title: 'Sportsnet 360',
    network: 'Sportsnet',
    year: '2013',
    sortYear: 2013,
    kind: 'Studio',
    key: 'connected',
    images: A['sportsnet-360'],
    source: ncs('sportsnet-360'),
  },
  {
    slug: 'sportsnet-studio-1',
    title: 'Sportsnet Studio 1',
    network: 'Sportsnet',
    year: '2013',
    sortYear: 2013,
    kind: 'Studio',
    key: 'desk',
    images: A['sportsnet-studio-1'],
    // The set NewscastStudio lists as Sportsnet, 2013.
    source: ncs('sportsnet'),
  },
  {
    slug: 'sportsnet-studio-3',
    title: 'Sportsnet Studio 3',
    network: 'Sportsnet',
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'desk',
    images: A['sportsnet-studio-3'],
    source: archived('sportsnet-studio-3'),
  },
  {
    slug: 'et-canada-new-years-eve',
    title: "ET Canada New Year's Eve",
    network: 'Global',
    // The countdown on the set rings in 2012: the show went out December 31, 2011.
    year: '2011',
    sortYear: 2011,
    kind: 'Live broadcast',
    key: 'countdown',
    images: A['et-canada-new-years-eve'],
    source: archived('et-canada-new-years-eve'),
  },
  {
    slug: 'global-ottawa-studio',
    title: 'Global Ottawa studio',
    network: 'Global',
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'chroma',
    images: A['global-ottawa-studio'],
    source: archived('global-ottawa-studio'),
  },
  {
    slug: 'tiff',
    title: 'TIFF press conferences',
    network: 'Toronto International Film Festival',
    year: '2007',
    sortYear: 2007,
    kind: 'Festival',
    key: 'panel',
    images: A['tiff'],
  },
  {
    slug: 'lord-of-the-rings-exhibit',
    title: 'Lord of the Rings exhibit',
    network: '',
    year: '',
    sortYear: 0,
    kind: 'Event',
    key: 'hall',
    images: A['lord-of-the-rings-exhibit'],
    source: archived('lord-of-the-rings-exhibit'),
  },
  {
    slug: 'events',
    title: 'Galas and corporate events',
    network: 'Private clients',
    year: '2005 to 2009',
    sortYear: 2005,
    kind: 'Event',
    key: 'gala-beams',
    images: A['events'],
  },
];

export const allShows: Show[] = [hero, ...shows];

const fromShow = (s: Show, production = s.title): Credit => ({
  year: s.year,
  sortYear: s.sortYear,
  production,
  network: s.network,
  kind: s.kind,
  show: s.slug,
  source: s.source,
  note: s.note,
});

/**
 * Every credit. Shows with photos link to their plate; the rest come from
 * published sources (his 2018 NewscastStudio interview, his 2022 TV
 * Technology article) and his IMDb credits.
 */
export const credits: Credit[] = [
  ...allShows.map((s) => fromShow(s)),
  {
    year: '2011',
    sortYear: 2011,
    production: 'The Royal Wedding',
    network: 'Broadcast coverage',
    kind: 'Live broadcast',
    source: tvTech,
  },
  {
    year: '',
    sortYear: 0,
    production: 'Hockey Night in Canada',
    network: 'Sportsnet',
    kind: 'Live broadcast',
    source: {
      label: 'NewscastStudio',
      url: 'https://www.newscaststudio.com/2018/01/18/qa-lighting-citys-new-breakfast-television-studio-arri-leds/',
    },
  },
  {
    year: '',
    sortYear: 0,
    production: 'Genie Awards',
    network: 'Academy of Canadian Cinema and Television',
    kind: 'Awards',
    source: tvTech,
  },
  {
    year: '',
    sortYear: 0,
    production: 'TED conferences',
    network: 'TED',
    kind: 'Event',
    source: {
      label: 'NewscastStudio',
      url: 'https://www.newscaststudio.com/2018/01/18/qa-lighting-citys-new-breakfast-television-studio-arri-leds/',
    },
  },
  {
    year: '',
    sortYear: 0,
    production: 'More than two dozen studios',
    network: 'Rogers Communications',
    kind: 'Studio',
    source: {
      label: 'NewscastStudio',
      url: 'https://www.newscaststudio.com/2022/04/04/sportsnet-arri-lighting-case-study/',
    },
  },
  // From IMDb (approved as a source by Miller, 2026-10-22).
  { year: '2019 to 2021', sortYear: 2019, production: 'Fire Masters', network: 'Food Network Canada', kind: 'Series', source: imdb },
  { year: '2021', sortYear: 2021, production: 'Juno Opening Night Awards', network: 'CARAS', kind: 'Awards', source: imdb },
  { year: '2017', sortYear: 2017, production: 'Still Standing', network: 'CBC', kind: 'Series', source: imdb },
  { year: '2016', sortYear: 2016, production: 'The Whole Truths', network: '', kind: 'Series', source: imdb },
  { year: '2011', sortYear: 2011, production: 'A Russell Peters Christmas Special', network: 'CTV', kind: 'Series', source: imdb },
  { year: '2007 to 2008', sortYear: 2007, production: 'History Bites', network: 'History Television', kind: 'Series', source: imdb },
  { year: '2005', sortYear: 2005, production: 'Design to Win', network: '', kind: 'Series', source: imdb },
  { year: '2004', sortYear: 2004, production: 'Style by Jury', network: 'W Network', kind: 'Series', source: imdb },
];

export const imageUrl = (slug: string, id: string, size: 'full' | 'm' = 'full') =>
  `${import.meta.env.BASE_URL}shows/${slug}/${id}${size === 'm' ? '-m' : ''}.webp`;

export const sketchUrl = (slug: string, id: string) =>
  `${import.meta.env.BASE_URL}shows/${slug}/${id}.json`;
