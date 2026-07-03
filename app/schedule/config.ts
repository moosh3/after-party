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
  assetKey?: string;
  playbackId?: string;
  assetId?: string;
  captions?: string;
}

export interface ScheduleSettings {
  channel: string;
  brandLine: string;
  marathonArt: string;
  stamp: string;
  date: string;
  eventDate: string;
  timezone: string;
  tzLabel: string;
  stillsDir: string;
  joinUrl: string;
  homeHref: string;
  ticker: string[];
  footerLeft: string;
  footerRight: string;
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

export const ADS: AdEntry[] = [
  { brand: 'NOT THE BEES CO.', headline: 'BEES? HANDLED.', say: 'pest removal, screamed into the void.', cta: 'CALL 1-900-NO-BEES', accent: 'yellow', imgNote: '[ cage vs. the bees ]' },
  { brand: 'THE CAGE FAN CLUB', headline: 'A NIC A DAY', say: 'monthly box: one nic, infinite faces.', cta: 'JOIN B4 MIDNIGHT', accent: 'lime', imgNote: '[ nic, contemplating ]' },
  { brand: 'ALPHABET INSURANCE', headline: "A! B! C! ...AAARGH", say: 'spell your feelings. we cover the rest.', cta: 'GET A QUOTE', accent: 'pink', imgNote: "[ vampire's kiss cage ]" },
  { brand: 'PUT THE BUNNY BACK', headline: 'BUNNY PROTECTION', say: 'insure the bunny. insure the box.', cta: 'DIAL 1-800-BUNNY', accent: 'frost2', imgNote: '[ con air cage + bunny ]' },
];
