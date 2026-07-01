export type ScheduleAccent = 'lime' | 'mint' | 'yellow' | 'frost2' | 'frost3' | 'pink' | 'cream';

export interface ScheduleEntry {
  start: string;
  end: string;
  title: string;
  rating?: string;
  runtime?: string;
  blurb?: string;
  still?: string;
  accent?: ScheduleAccent;
}

export interface AdEntry {
  brand: string;
  headline: string;
  say?: string;
  cta?: string;
  accent?: ScheduleAccent;
  imgNote?: string;
  img?: string;
}

export type ScheduleLayout = 'classic' | 'sidebar' | 'fullroll';

export interface ScheduleTweaks {
  layout: ScheduleLayout;
  tagline: string;
  scrollSpeed: number;
  adSeconds: number;
  showTicker: boolean;
}

export const TWEAKS_DEFAULTS: ScheduleTweaks = {
  layout: 'sidebar',
  tagline: 'where we like to watch movies',
  scrollSpeed: 21,
  adSeconds: 15,
  showTicker: true,
};

export const TWEAKS_STORAGE_KEY = 'da-movies:schedule-tweaks';

export const SETTINGS = {
  channel: 'CAGE-A-THON',
  brandLine: "WATCHIN' DA MOVIES",
  marathonArt: '/assets/images/cage-a-thon.png',
  stamp: 'JUL 4 · CHICAGO (CT)',
  date: 'SATURDAY, JULY 4 · 2026',

  // powers the auto "ON NOW" highlight + grey-out of finished films
  eventDate: '2026-07-04',
  timezone: 'America/Chicago',
  tzLabel: 'CT',

  // movie stills: one image per SCHEDULE entry, kept in this folder.
  // missing files fall back to a placeholder automatically (still true
  // for "Next (2007)" — no still supplied for that one yet).
  stillsDir: '/assets/images/movie-stills',

  joinUrl: '/event',
  homeHref: '/',

  ticker: [
    '*JULY 4TH CAGE-A-THON · all times CHICAGO (CT)',
    '8 films · one national treasure',
    '*ENCORE: National Treasure again at 11:45 PM',
    'byo blanket · snacks in da coatcheck',
  ],
  footerLeft: '© 2026 damovies.watch · july 4th cage-a-thon',
  footerRight: 'CH 1 · CAGE-A-THON · all times CT',
};

export const SCHEDULE: ScheduleEntry[] = [
  { start: '9:00 AM', end: '11:11 AM', title: 'National Treasure (2004)', rating: 'PG', runtime: '2h 11m', still: 'national-treasure.jpg', blurb: 'cage steals the declaration of independence. for freedom.', accent: 'lime' },
  { start: '11:30 AM', end: '1:09 PM', title: 'Valley Girl (1983)', rating: 'R', runtime: '1h 39m', still: 'valley-girl.png', blurb: 'punk meets the mall. baby cage, big feelings.' },
  { start: '1:15 PM', end: '3:19 PM', title: 'National Treasure: Book of Secrets (2007)', rating: 'PG', runtime: '2h 04m', still: 'book-of-secrets.jpg', blurb: 'he kidnaps the president. very politely.' },
  { start: '3:30 PM', end: '5:06 PM', title: 'Next (2007)', rating: 'PG-13', runtime: '1h 36m', still: 'next.jpg', blurb: 'cage sees 2 minutes into the future. we see 96.' },
  { start: '5:30 PM', end: '7:13 PM', title: "Vampire's Kiss (1988)", rating: 'R', runtime: '1h 43m', still: 'vampires-kiss.jpg', blurb: 'the alphabet scene. you know the one.' },
  { start: '7:30 PM', end: '9:25 PM', title: 'Con Air (1997)', rating: 'R', runtime: '1h 55m', still: 'con-air.jpg', blurb: 'put the bunny back in the box. prime time.', accent: 'yellow' },
  { start: '9:45 PM', end: '11:35 PM', title: 'Ghost Rider (2007)', rating: 'PG-13', runtime: '1h 50m', still: 'ghost-rider.jpg', blurb: 'flaming skull, flaming freedom. fireworks pairing.' },
  { start: '11:45 PM', end: '1:56 AM', title: 'National Treasure (2004) — ENCORE', rating: 'PG', runtime: '2h 11m', still: 'national-treasure.jpg', blurb: 'round two. a treasure never sleeps.', accent: 'frost2' },
];

export const ADS: AdEntry[] = [
  { brand: 'NOT THE BEES CO.', headline: 'BEES? HANDLED.', say: 'pest removal, screamed into the void.', cta: 'CALL 1-900-NO-BEES', accent: 'yellow', imgNote: '[ cage vs. the bees ]' },
  { brand: 'THE CAGE FAN CLUB', headline: 'A NIC A DAY', say: 'monthly box: one nic, infinite faces.', cta: 'JOIN B4 MIDNIGHT', accent: 'lime', imgNote: '[ nic, contemplating ]' },
  { brand: 'ALPHABET INSURANCE', headline: "A! B! C! ...AAARGH", say: 'spell your feelings. we cover the rest.', cta: 'GET A QUOTE', accent: 'pink', imgNote: "[ vampire's kiss cage ]" },
  { brand: 'PUT THE BUNNY BACK', headline: 'BUNNY PROTECTION', say: 'insure the bunny. insure the box.', cta: 'DIAL 1-800-BUNNY', accent: 'frost2', imgNote: '[ con air cage + bunny ]' },
];
