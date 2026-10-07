import type { DungeonId } from '@/sim/dungeon/progress';
import type { IslandId } from '@/sim/world/types';

/** The dungeon a far island hides (the home island has several). */
const DUNGEON_OF: Record<IslandId, DungeonId | null> = {
  home: null, frost: 'frostcave', ember: 'magmaforge', wreck: 'drownedcrypt', sky: 'skyspire',
};

export const dungeonOf = (id: IslandId): DungeonId | null => DUNGEON_OF[id];
