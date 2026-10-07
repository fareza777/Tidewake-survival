import { Rng, hashString } from '@/core/rng';
import { DAY_SECONDS } from '@/sim/daynight';
import { B, type Biome } from '@/sim/world/types';

/** The year has four seasons of eight days each. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const DAYS_PER_SEASON = 8;

export const WEATHERS = ['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'] as const;
export type Weather = (typeof WEATHERS)[number];

/** The season a day belongs to (day 1 is the first day of spring). */
export const seasonOf = (day: number): Season => SEASONS[Math.floor((Math.max(1, day) - 1) / DAYS_PER_SEASON) % SEASONS.length];

/** 1 to DAYS_PER_SEASON. */
export const dayOfSeason = (day: number): number => ((Math.max(1, day) - 1) % DAYS_PER_SEASON) + 1;

/** How many times the weather can change in a day. */
export const BLOCKS_PER_DAY = 3;

type Table = readonly (readonly [Weather, number])[];

const TABLES: Record<Season, Table> = {
  spring: [['clear', 30], ['cloudy', 25], ['rain', 30], ['storm', 5], ['fog', 10]],
  summer: [['clear', 55], ['cloudy', 20], ['rain', 10], ['storm', 12], ['fog', 3]],
  autumn: [['clear', 25], ['cloudy', 30], ['rain', 25], ['storm', 5], ['fog', 15]],
  winter: [['clear', 25], ['cloudy', 25], ['snow', 35], ['storm', 5], ['fog', 10]],
};

const cache = new Map<string, Weather>();

/** The weather at time `t` (seconds since dawn) of `day`. The same seed always gives the same weather. */
export function weatherAt(seed: number, day: number, t: number): Weather {
  const block = Math.min(BLOCKS_PER_DAY - 1, Math.floor((Math.max(0, t) / DAY_SECONDS) * BLOCKS_PER_DAY));
  const key = `${seed}:${day}:${block}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const table = TABLES[seasonOf(day)];
  const front = new Rng(hashString(`${seed}:wx:${day}`)).weighted(table);
  const weather = new Rng(hashString(`${seed}:wx:${day}:${block}`));
  const result = weather.chance(0.62) ? front : weather.weighted(table);
  if (cache.size > 400) cache.clear();
  cache.set(key, result);
  return result;
}

export const isWet = (w: Weather): boolean => w === 'rain' || w === 'storm';

/** What to call the weather: a storm in winter is a blizzard. */
export const weatherName = (season: Season, w: Weather): string => (season === 'winter' && w === 'storm' ? 'blizzard' : w);

/** Extra darkness of the daytime sky (added to the night overlay's alpha). */
export const WEATHER_DARKNESS: Record<Weather, number> = { clear: 0, cloudy: 0.06, rain: 0.15, storm: 0.28, fog: 0.1, snow: 0.1 };

/**
 * How cold it feels, from 0 (mild) up to about 2.5 (a winter night in a blizzard on a mountain). Anything below 0 is
 * warm. The cold wears the warmth meter down unless the hero is dressed for it or sits by a fire.
 */
export function coldOf(season: Season, weather: Weather, night: boolean, biome: Biome, sheltered = false): number {
  let cold = { spring: 0, summer: -0.6, autumn: 0.25, winter: 0.9 }[season];
  if (night) cold += biome === B.DESERT ? 0.9 : 0.5;
  if (!sheltered) {
    cold += { clear: 0, cloudy: 0.05, rain: 0.4, storm: 0.7, fog: 0.15, snow: 0.8 }[weather];
  }
  if (biome === B.MOUNTAIN) cold += 0.35;
  else if (biome === B.FROST) cold += 0.9;
  else if (biome === B.VOLCANO) cold -= 1.1;
  else if (biome === B.SKY) cold += 0.4;
  else if (biome === B.WRECK) cold += 0.1;
  else if (biome === B.SWAMP) cold += 0.15;
  else if (biome === B.DESERT && !night) cold -= 0.6;
  return cold;
}
