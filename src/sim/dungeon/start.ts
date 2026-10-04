import type { Rng } from '@/core/rng';
import { CREATURES } from '@/data/creatures';
import { newCreature, type Creature } from '@/sim/creatures';
import { emptyEncounters, type Encounters } from '@/sim/encounters';
import { ROOM_H, ROOM_W } from './layout';
import type { DungeonProgress } from './progress';
import type { Dungeon } from './types';

/** The creatures and crystals of a dungeon the hero has just entered: whatever his progress has not already dealt with. */
export function startEncounters(d: Dungeon, p: DungeonProgress, rng: Rng): Encounters {
  const creatures: Creature[] = [];
  let id = 1;
  const add = (kind: Creature['kind'], x: number, y: number): void => {
    creatures.push(newCreature(id++, kind, x + 0.5, y + 0.5, rng));
  };
  for (const s of d.spawns) if (!p.solved.includes(s.room)) add(s.kind, s.x, s.y);
  if (!p.boss) add(d.boss.kind, d.boss.x, d.boss.y);
  // A crystal is struck by its own id, so the event says which one to light.
  const targets = d.crystals.filter((c) => !p.lit.includes(c.id)).map((c) => ({ id: c.id, x: c.x + 0.5, y: c.y + 0.5 }));
  return { ...emptyEncounters(), creatures, targets, nextId: id, spawnTimer: 1e9 };
}

/** How many creatures stand inside the room right now. */
export function creaturesInRoom(e: Encounters, d: Dungeon, roomId: number): number {
  const r = d.rooms[roomId];
  return e.creatures.filter((c) => c.x >= r.x0 && c.x < r.x0 + ROOM_W && c.y >= r.y0 && c.y < r.y0 + ROOM_H).length;
}

/** The boss, if it is still alive. */
export const bossOf = (e: Encounters, d: Dungeon): Creature | undefined => e.creatures.find((c) => c.kind === d.boss.kind && CREATURES[c.kind].temper === 'boss');
