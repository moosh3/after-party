import { Bungee, Bungee_Shade, VT323, Comic_Neue, Outfit } from 'next/font/google';

export const bungee = Bungee({ subsets: ['latin'], weight: '400', variable: '--ll-f-bungee' });
export const bungeeShade = Bungee_Shade({ subsets: ['latin'], weight: '400', variable: '--ll-f-bungee-shade' });
export const vt323 = VT323({ subsets: ['latin'], weight: '400', variable: '--ll-f-vt323' });
export const comicNeue = Comic_Neue({ subsets: ['latin'], weight: ['400', '700'], variable: '--ll-f-comic-neue' });
export const outfit = Outfit({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--ll-f-outfit' });

export const LL_FONT_VARS = [
  bungee.variable,
  bungeeShade.variable,
  vt323.variable,
  comicNeue.variable,
  outfit.variable,
].join(' ');
