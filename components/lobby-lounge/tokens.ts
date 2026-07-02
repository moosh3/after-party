// Da Lobby Lounge — shared Y2K palette for the visitor-facing flow
// (Landing, Login, Home, Watch, Door). Matches the design handoff 1:1.

export const LL = {
  ink: '#1a1230',
  deep: '#2a1a55',
  frost1: '#f5fbff',
  frost2: '#cbb6ff',
  frost3: '#a18ad4',
  mint: '#b9f4d6',
  lime: '#c9ff2d',
  yellow: '#ffe600',
  pink: '#ff2eb8',
  cream: '#fff5d6',
} as const;

export const LL_REEL = {
  body: LL.ink,
  rim: LL.mint,
  hole: LL.yellow,
  face: LL.frost1,
  pupil: LL.ink,
  cheek: LL.frost2,
  mouth: LL.ink,
};

export const LL_FROST = `linear-gradient(160deg, ${LL.frost1} 0%, ${LL.frost2} 100%)`;
export const LL_VELVET = `linear-gradient(180deg, ${LL.deep} 0%, ${LL.ink} 100%)`;
