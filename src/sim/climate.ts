import { STRUCTURES } from '@/data/structures';
import type { Clock } from '@/sim/daynight';
import { isNight } from '@/sim/daynight';
import type { Structures } from '@/sim/structures';
import { coldOf, seasonOf, weatherAt, type Season, type Weather } from '@/sim/weather';
import type { Biome } from '@/sim/world/types';

export interface Climate {
  season: Season;
  weather: Weather;
  /** How cold it feels here (below 0 is warm). */
  cold: number;
  /** A fire, furnace or lamp is close enough to warm the hero. */
  heated: boolean;
  /** A bed or tent is close enough to keep the rain and the wind off. */
  sheltered: boolean;
}

interface Where {
  x: number;
  y: number;
}

/** Is a structure with this reach (`heat` or `shelter`) near the hero? */
function near(structures: Structures, pos: Where, reach: 'heat' | 'shelter'): boolean {
  return structures.list.some((s) => {
    const r = STRUCTURES[s.type][reach];
    return r !== undefined && Math.hypot(s.x + 0.5 - pos.x, s.y + 0.5 - pos.y) <= r;
  });
}

export const shelteredAt = (structures: Structures, pos: Where): boolean => near(structures, pos, 'shelter');

/** The season, the weather and what they mean for the hero at this spot, this moment. */
export function climateAt(seed: number, clock: Clock, structures: Structures, pos: Where, biome: Biome): Climate {
  const season = seasonOf(clock.day);
  const weather = weatherAt(seed, clock.day, clock.t);
  const sheltered = shelteredAt(structures, pos);
  return {
    season, weather, sheltered, heated: near(structures, pos, 'heat'),
    cold: coldOf(season, weather, isNight(clock), biome, sheltered),
  };
}
