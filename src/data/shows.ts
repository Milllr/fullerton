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

export interface Show {
  slug: string;
  title: string;
  /** Empty when the network or client isn't known. */
  network: string;
  /** A shorter name for the network where the index has no room for the full one. */
  short?: string;
  /** Display year, e.g. "2021" or "2008 to 2014". Empty when unknown. */
  year: string;
  /** Sort key for the credits list. 0 sorts to the end. */
  sortYear: number;
  kind: Kind;
  /** Image id of the photo that stands for the show in the index. */
  key: string;
  images: ShowImage[];
  source?: Source;
}

export type Kind = 'Studio' | 'Live broadcast' | 'Awards' | 'Festival' | 'Event' | 'Series' | 'Exhibition';

export interface Credit {
  year: string;
  sortYear: number;
  production: string;
  network: string;
  kind: Kind;
  show?: string;
  source?: Source;
}

const A = assets as Record<string, ShowImage[]>;

const ncs = (path: string): Source => ({
  label: 'NewscastStudio',
  url: `https://www.newscaststudio.com/setstudio/${path}/`,
});

const interview2018: Source = {
  label: 'NewscastStudio',
  url: 'https://www.newscaststudio.com/2018/01/18/qa-lighting-citys-new-breakfast-television-studio-arri-leds/',
};

const tvTech2022: Source = {
  label: 'TV Technology',
  url: 'https://www.tvtechnology.com/equipment/designing-tomorrows-tv-studio-from-the-ground-up-with-arri-lighting',
};

/**
 * Every show with photos, in index order. The photos come from the family
 * archive (including raw/archive-2016); years are only given where a
 * source or the photo metadata has them.
 */
export const shows: Show[] = [
  {
    slug: 'sportsnet-studios',
    title: 'Sportsnet Studios 31 and 32',
    network: 'Sportsnet',
    year: '2021',
    sortYear: 2021,
    kind: 'Studio',
    key: 'studio-31',
    images: A['sportsnet-studios'],
    source: ncs('sportsnet-2'),
  },
  {
    slug: 'super-bowl-xliv',
    title: 'Super Bowl XLIV',
    network: 'CBS',
    year: '2010',
    sortYear: 2010,
    kind: 'Live broadcast',
    key: 'nfl-on-cbs',
    images: A['super-bowl-xliv'],
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
  },
  {
    slug: 'breakfast-television',
    title: 'Breakfast Television',
    network: 'City',
    year: '2017',
    sortYear: 2017,
    kind: 'Studio',
    key: 'platform',
    images: A['breakfast-television'],
    source: ncs('breakfast-television'),
  },
  {
    slug: 'gemini-awards',
    title: 'Gemini Awards',
    network: 'Academy of Canadian Cinema and Television',
    short: 'Canadian Academy',
    year: '',
    sortYear: 0,
    kind: 'Awards',
    key: 'beams',
    images: A['gemini-awards'],
    source: tvTech2022,
  },
  {
    slug: 'hockey-night-in-canada',
    title: 'Hockey Night in Canada',
    network: 'Sportsnet',
    year: '',
    sortYear: 0,
    kind: 'Live broadcast',
    key: 'studio',
    images: A['hockey-night-in-canada'],
    source: interview2018,
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
  },
  {
    slug: 'et-canada-new-years-eve',
    title: 'ET Canada New Year’s Eve',
    network: 'Global',
    year: '',
    sortYear: 0,
    kind: 'Live broadcast',
    key: 'stage',
    images: A['et-canada-new-years-eve'],
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
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'centre',
    images: A['sportsnet-studio-1'],
  },
  {
    slug: 'sportsnet-studio-3',
    title: 'Sportsnet Studio 3',
    network: 'Sportsnet',
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'anchors',
    images: A['sportsnet-studio-3'],
  },
  {
    slug: 'the-ron-james-show',
    title: 'The Ron James Show',
    network: 'CBC',
    year: '',
    sortYear: 0,
    kind: 'Series',
    key: 'set',
    images: A['the-ron-james-show'],
  },
  {
    slug: 'the-score',
    title: 'theScore studio',
    network: 'theScore',
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'floor',
    images: A['the-score'],
  },
  {
    slug: 'global-ottawa',
    title: 'Global Ottawa studio',
    network: 'Global',
    year: '',
    sortYear: 0,
    kind: 'Studio',
    key: 'studio',
    images: A['global-ottawa'],
  },
  {
    slug: 'tiff',
    title: 'TIFF press conferences',
    network: 'Toronto International Film Festival',
    short: 'TIFF',
    year: '2007',
    sortYear: 2007,
    kind: 'Festival',
    key: 'panel',
    images: A['tiff'],
  },
  {
    slug: 'lord-of-the-rings',
    title: 'The Lord of the Rings exhibition',
    network: '',
    year: '',
    sortYear: 0,
    kind: 'Exhibition',
    key: 'tree',
    images: A['lord-of-the-rings'],
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

const fromShow = (s: Show): Credit => ({
  year: s.year,
  sortYear: s.sortYear,
  production: s.title,
  network: s.network,
  kind: s.kind,
  show: s.slug,
  source: s.source,
});

/**
 * Every credit. Shows with photos link to their sheet; the rest come from
 * published sources (NewscastStudio set credits, his 2018 NewscastStudio
 * interview, and his 2022 TV Technology article).
 */
export const credits: Credit[] = [
  ...shows.map(fromShow),
  {
    year: '2014',
    sortYear: 2014,
    production: 'Hockey Central and Hockey Night in Canada studio',
    network: 'Sportsnet',
    kind: 'Studio',
    source: ncs('hockey-central'),
  },
  {
    year: '2013',
    sortYear: 2013,
    production: 'Sportsnet studio',
    network: 'Sportsnet',
    kind: 'Studio',
    source: ncs('sportsnet'),
  },
  {
    year: '2011',
    sortYear: 2011,
    production: 'The Royal Wedding',
    network: 'Broadcast coverage',
    kind: 'Live broadcast',
    source: tvTech2022,
  },
  {
    year: '',
    sortYear: 0,
    production: 'Genie Awards',
    network: 'Academy of Canadian Cinema and Television',
    kind: 'Awards',
    source: tvTech2022,
  },
  {
    year: '',
    sortYear: 0,
    production: 'TED conferences',
    network: 'TED',
    kind: 'Event',
    source: interview2018,
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
];

export const imageUrl = (slug: string, id: string, size: 'full' | 'm' = 'full') =>
  `${import.meta.env.BASE_URL}shows/${slug}/${id}${size === 'm' ? '-m' : ''}.webp`;

export const keyImage = (s: Show) => s.images.find((im) => im.id === s.key) ?? s.images[0];
