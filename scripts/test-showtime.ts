import assert from 'node:assert/strict';
import { loadShowtime, parseShowtimeYaml, resolveShowtimePlayoutFor } from '../lib/showtime';

const baseYaml = `
event:
  slug: test-show
  title: Test Show
  date: 2026-07-04
  timezone: America/Chicago
  channel: TEST
  defaultHoldAsset: hold
assets:
  hold:
    title: Hold
    playbackId: hold-playback
  movie:
    title: Movie
    playbackId: movie-playback
schedule:
  - id: movie-one
    start: "09:00"
    end: "10:00"
    asset: movie
`;

function expectInvalid(source: string, message: RegExp) {
  assert.throws(() => parseShowtimeYaml(source), message);
}

const showtime = loadShowtime();

assert.equal(showtime.event.slug, 'cage-a-thon-2026');
assert.equal(showtime.assets['national-treasure'].assetId, 'lYOIuSPBfwair3597nD8P5JTlLX5VsArV3A8KDK8kow');
assert.equal(showtime.assets['national-treasure'].playbackId, '5K0001THGMsHg02oRgspFcKcR1sEqtr00ZpcvM8AUdOtO1A');
assert.equal(showtime.schedule.at(-1)?.id, 'national-treasure-encore');
assert.ok(showtime.schedule.at(-1)!.absoluteEndMinute > showtime.schedule.at(-1)!.absoluteStartMinute);

const before = resolveShowtimePlayoutFor(showtime, new Date('2026-07-04T13:30:00.000Z'));
assert.equal(before.status, 'before');
assert.equal(before.isHoldScreen, true);
assert.equal(before.playbackPosition, 310);

const nationalTreasure = resolveShowtimePlayoutFor(showtime, new Date('2026-07-04T14:30:00.000Z'));
assert.equal(nationalTreasure.status, 'movie');
assert.equal(nationalTreasure.activeSlotId, 'national-treasure-am');
assert.equal(nationalTreasure.playbackPosition, 1800);

const firstGap = resolveShowtimePlayoutFor(showtime, new Date('2026-07-04T16:20:00.000Z'));
assert.equal(firstGap.status, 'gap');
assert.equal(firstGap.isHoldScreen, true);
assert.equal(firstGap.playbackPosition, 540);

const endedEarly = resolveShowtimePlayoutFor(
  showtime,
  new Date('2026-07-04T15:50:00.000Z'),
  'national-treasure-am',
  '2026-07-04T15:45:00.000Z'
);
assert.equal(endedEarly.status, 'ended-early');
assert.equal(endedEarly.isHoldScreen, true);
assert.equal(endedEarly.playbackPosition, 300);

const wallClockTakeover = resolveShowtimePlayoutFor(
  showtime,
  new Date('2026-07-04T16:35:00.000Z'),
  'national-treasure-am'
);
assert.equal(wallClockTakeover.status, 'movie');
assert.equal(wallClockTakeover.activeSlotId, 'valley-girl');

const after = resolveShowtimePlayoutFor(showtime, new Date('2026-07-05T08:00:00.000Z'));
assert.equal(after.status, 'after');
assert.equal(after.isHoldScreen, true);

expectInvalid(
  baseYaml.replace('playbackId: movie-playback', ''),
  /assets\.movie\.playbackId is required/
);

expectInvalid(
  baseYaml.replace('asset: movie', 'asset: missing-movie'),
  /references unknown asset/
);

expectInvalid(
  baseYaml.replace(
    '  - id: movie-one\n    start: "09:00"\n    end: "10:00"\n    asset: movie',
    '  - id: movie-one\n    start: "09:00"\n    end: "10:00"\n    asset: movie\n  - id: overlap\n    start: "09:30"\n    end: "11:00"\n    asset: movie'
  ),
  /overlaps/
);

expectInvalid(
  baseYaml.replace('end: "10:00"', 'end: "09:00"'),
  /end must be after start/
);

const overnight = parseShowtimeYaml(
  baseYaml.replace('end: "10:00"', 'end: "01:00"')
);
assert.equal(overnight.schedule[0].absoluteEndMinute, 1500);

console.log('showtime validation passed');
