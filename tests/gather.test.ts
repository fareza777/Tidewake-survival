import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { RESOURCES } from '@/data/resources';
import { RESPAWN_DAYS, emptyGather, hitNode, isAlive, startNewDay } from '@/sim/gather';
import type { ResourceNode } from '@/sim/world/types';

const tree: ResourceNode = { id: 7, kind: 'tree', x: 10, y: 10, variant: 3 };
const rock: ResourceNode = { id: 8, kind: 'rock', x: 12, y: 10, variant: 1 };

describe('hitNode', () => {
  it('chips a node without destroying it and keeps the input untouched', () => {
    const s = emptyGather();
    const r = hitNode(s, tree, 1, 1, new Rng(1));
    expect(r.destroyed).toBe(false);
    expect(r.drops).toEqual([]);
    expect(r.state.hp[7]).toBe(RESOURCES.tree.hp - 1);
    expect(s).toEqual(emptyGather());
  });

  it('destroys a node after enough hits and drops items within the configured range', () => {
    let s = emptyGather();
    let last = hitNode(s, tree, 1, 1, new Rng(2));
    for (let i = 1; i < RESOURCES.tree.hp; i++) {
      s = last.state;
      last = hitNode(s, tree, 1, 1, new Rng(2));
    }
    expect(last.destroyed).toBe(true);
    expect(isAlive(last.state, tree.id)).toBe(false);
    expect(last.state.hp[tree.id]).toBeUndefined();
    const wood = last.drops.find((d) => d.item === 'wood')!;
    expect(wood.amount).toBeGreaterThanOrEqual(2);
    expect(wood.amount).toBeLessThanOrEqual(4);
  });

  it('can destroy in one hit with enough damage', () => {
    const r = hitNode(emptyGather(), rock, 99, 1, new Rng(3));
    expect(r.destroyed).toBe(true);
    expect(r.drops.every((d) => d.amount > 0)).toBe(true);
  });

  it('ignores hits on destroyed nodes and zero or negative damage', () => {
    const gone = hitNode(emptyGather(), rock, 99, 1, new Rng(3)).state;
    const again = hitNode(gone, rock, 5, 1, new Rng(3));
    expect(again.state).toBe(gone);
    expect(again.drops).toEqual([]);
    const s = emptyGather();
    expect(hitNode(s, tree, 0, 1, new Rng(1)).state).toBe(s);
    expect(hitNode(s, tree, -3, 1, new Rng(1)).state).toBe(s);
  });
});

describe('startNewDay', () => {
  it('heals damaged nodes', () => {
    const damaged = hitNode(emptyGather(), tree, 2, 1, new Rng(1)).state;
    expect(startNewDay(damaged, 2).hp).toEqual({});
  });

  it('regrows destroyed nodes only after RESPAWN_DAYS', () => {
    const gone = hitNode(emptyGather(), rock, 99, 5, new Rng(1)).state;
    expect(isAlive(startNewDay(gone, 5 + RESPAWN_DAYS - 1), rock.id)).toBe(false);
    expect(isAlive(startNewDay(gone, 5 + RESPAWN_DAYS), rock.id)).toBe(true);
  });

  it('postpones regrowth for nodes the caller wants to keep clear', () => {
    const gone = hitNode(emptyGather(), rock, 99, 1, new Rng(1)).state;
    const day = 1 + RESPAWN_DAYS;
    expect(isAlive(startNewDay(gone, day, (id) => id === rock.id), rock.id)).toBe(false);
    expect(isAlive(startNewDay(gone, day + 1), rock.id)).toBe(true);
  });

  it('keeps other nodes gone while one regrows', () => {
    let s = hitNode(emptyGather(), rock, 99, 1, new Rng(1)).state;
    s = hitNode(s, tree, 99, 3, new Rng(1)).state;
    const next = startNewDay(s, 1 + RESPAWN_DAYS);
    expect(isAlive(next, rock.id)).toBe(true);
    expect(isAlive(next, tree.id)).toBe(false);
  });
});
