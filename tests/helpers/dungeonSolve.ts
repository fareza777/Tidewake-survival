import type { Dungeon, Door } from '@/sim/dungeon/types';
import { ROOM_H, ROOM_W } from '@/sim/dungeon/layout';
import { T, idx } from '@/sim/world/types';

/** Tiles the hero can reach from the entrance, given which doors count as open. Pillars, crystals, chests and blocks are solid. */
export function reachable(d: Dungeon, isOpen: (door: Door) => boolean): Set<number> {
  const size = d.world.size;
  const solid = new Set<number>();
  for (const p of d.pillars) solid.add(idx(p.x, p.y, size));
  for (const c of d.crystals) solid.add(idx(c.x, c.y, size));
  for (const c of d.chests) solid.add(idx(c.x, c.y, size));
  for (const b of d.blocks) solid.add(idx(b.x, b.y, size));
  for (const door of d.doors) if (!isOpen(door)) solid.add(idx(door.x, door.y, size));
  const start = idx(Math.floor(d.entry.x), Math.floor(d.entry.y), size);
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    const x = cur % size;
    const y = Math.floor(cur / size);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const n = idx(nx, ny, size);
      if (seen.has(n) || solid.has(n) || d.world.terrain[n] !== T.FLOOR) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

export interface Playthrough {
  reachedBoss: boolean;
  keysLeft: number;
  gotBossKey: boolean;
  openDoors: number;
  chestsOpened: number;
}

/** Play the dungeon abstractly: open what can be opened, collect what can be reached, until nothing changes. */
export function playthrough(d: Dungeon): Playthrough {
  const size = d.world.size;
  const open = new Set<number>();
  let keys = 0;
  let bossKey = false;
  const opened = new Set<number>();
  for (let round = 0; round < 40; round++) {
    const reach = reachable(d, (door) => open.has(door.id));
    const inRoom = (roomId: number): boolean => {
      const r = d.rooms[roomId];
      for (let y = r.y0; y < r.y0 + ROOM_H; y++) for (let x = r.x0; x < r.x0 + ROOM_W; x++) if (reach.has(idx(x, y, size))) return true;
      return false;
    };
    const adjacent = (x: number, y: number): boolean => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(idx(x + dx, y + dy, size)));
    let changed = false;
    for (const door of d.doors) {
      if (open.has(door.id)) continue;
      const ok = door.lock === 'free' || (door.lock === 'room' && door.room !== null && inRoom(door.room)) || (door.lock === 'boss' && bossKey && adjacent(door.x, door.y));
      if (ok) {
        open.add(door.id);
        changed = true;
      }
    }
    for (const chest of d.chests) {
      if (opened.has(chest.id) || !adjacent(chest.x, chest.y)) continue;
      if (chest.locked) {
        if (keys === 0) continue;
        keys -= 1;
      }
      opened.add(chest.id);
      changed = true;
      for (const l of chest.loot) {
        if (l.item === 'small_key') keys += l.qty;
        if (l.item === 'boss_key') bossKey = true;
      }
    }
    if (!changed) break;
  }
  const finalReach = reachable(d, (door) => open.has(door.id));
  return {
    reachedBoss: finalReach.has(idx(d.boss.x, d.boss.y, size)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => finalReach.has(idx(d.boss.x + dx, d.boss.y + dy, size))),
    keysLeft: keys,
    gotBossKey: bossKey,
    openDoors: open.size,
    chestsOpened: opened.size,
  };
}
