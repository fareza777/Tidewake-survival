import { describe, expect, it } from 'vitest';
import type { ItemId } from '@/data/items';
import { emptyFarm } from '@/sim/farm';
import { resolveAction, type Action, type ActionContext } from '@/sim/actions';
import { generateDungeon } from '@/sim/dungeon/generate';
import { addItem, emptyInventory } from '@/sim/inventory';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { T, WORLD_SIZE, type World } from '@/sim/world/types';

function makeWorld(): World {
  const size = WORLD_SIZE;
  return { seed: 0, size, terrain: new Uint8Array(size * size).fill(T.GRASS), biome: new Uint8Array(size * size), landmarks: [], resources: [], start: { x: 10, y: 10 } };
}

const d = generateDungeon(1, 'grotto');
const chestFree = d.chests.find((c) => !c.locked)!;
const chestLocked = d.chests.find((c) => c.locked)!;
const bossDoor = d.doors.find((x) => x.lock === 'boss')!;

/** Hero at (10.5, 10.5) facing right; `give` puts items in the backpack. */
function ctx(over: Partial<ActionContext> & { give?: [ItemId, number][] } = {}): ActionContext {
  const { give, ...rest } = over;
  let inv = emptyInventory();
  for (const [item, n] of give ?? []) inv = addItem(inv, item, n).inv;
  return {
    world: makeWorld(), inv, selected: 0, vitals: fullVitals(), pos: { x: 10.5, y: 10.5 }, facing: 'right', structures: emptyStructures(),
    farm: emptyFarm(), occupied: new Set(), node: null, creature: false, entrance: null, target: null, ...rest,
  };
}
const kind = (a: Action): string => a.kind;

describe('dungeon entrances and exits', () => {
  it('goes in when the tile in front is a dungeon entrance, whatever is held', () => {
    expect(resolveAction(ctx({ entrance: 'grotto' }))).toEqual({ kind: 'enter', dungeon: 'grotto' });
    expect(resolveAction(ctx({ entrance: 'ruin', give: [['axe_wood', 1]] }))).toEqual({ kind: 'enter', dungeon: 'ruin' });
    expect(resolveAction(ctx({ entrance: 'deepmine', give: [['cooked_meat', 1]] }))).toEqual({ kind: 'enter', dungeon: 'deepmine' });
  });

  it('goes out through the exit doorway', () => {
    expect(resolveAction(ctx({ target: { kind: 'exit' } }))).toEqual({ kind: 'leave' });
  });

  it('still lets a building in front come first, as everywhere else', () => {
    const structures = placeStructure(emptyStructures(), 'workbench', 11, 10);
    expect(kind(resolveAction(ctx({ entrance: 'grotto', structures })))).toBe('open');
  });
});

describe('chests and doors', () => {
  it('opens a chest that is not locked without any key', () => {
    expect(resolveAction(ctx({ target: { kind: 'chest', chest: chestFree } }))).toEqual({ kind: 'chest', chest: chestFree });
  });

  it('needs a small key for a locked chest, and says so when there is none', () => {
    const target = { kind: 'chest', chest: chestLocked } as const;
    expect(resolveAction(ctx({ target }))).toEqual({ kind: 'blocked', reason: 'needsKey' });
    expect(resolveAction(ctx({ target, give: [['boss_key', 1]] }))).toEqual({ kind: 'blocked', reason: 'needsKey' });
    expect(resolveAction(ctx({ target, give: [['small_key', 1]] }))).toEqual({ kind: 'chest', chest: chestLocked });
  });

  it('needs the boss key for the boss door, and says so when there is none', () => {
    const target = { kind: 'door', door: bossDoor } as const;
    expect(resolveAction(ctx({ target }))).toEqual({ kind: 'blocked', reason: 'needsBossKey' });
    expect(resolveAction(ctx({ target, give: [['small_key', 3]] }))).toEqual({ kind: 'blocked', reason: 'needsBossKey' });
    expect(resolveAction(ctx({ target, give: [['boss_key', 1]] }))).toEqual({ kind: 'door', door: bossDoor });
  });
});
