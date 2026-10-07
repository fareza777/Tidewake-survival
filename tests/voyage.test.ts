import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { emptyProgress } from '@/sim/dungeon/progress';
import { resolveAction } from '@/sim/actions';
import { addItem, emptyInventory } from '@/sim/inventory';
import { ISLAND_IDS, islandNeeds, islandUnlocked, worldFor } from '@/sim/islands';
import { applyAction, sailTo, sessionFromSlot, type Session } from '@/sim/session';
import { placeStructure } from '@/sim/structures';
import { fullVitals } from '@/sim/vitals';
import { emptyFarm } from '@/sim/farm';
import { generateWorld } from '@/sim/world/generate';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const beaten = (...ids: ('frostcave' | 'magmaforge' | 'drownedcrypt')[]): Session['dungeons'] => {
  const d = base().dungeons;
  return { ...d, ...Object.fromEntries(ids.map((id) => [id, { ...emptyProgress(), boss: true }])) } as Session['dungeons'];
};

describe('the sea route', () => {
  it('opens the frozen and the burning island at once, the wreck after one of them is conquered and the sky after all three', () => {
    const none = base().dungeons;
    expect(ISLAND_IDS.filter((id) => islandUnlocked(none, id))).toEqual(['home', 'frost', 'ember']);
    expect(islandUnlocked(beaten('frostcave'), 'wreck')).toBe(true);
    expect(islandUnlocked(beaten('magmaforge'), 'wreck')).toBe(true);
    expect(islandUnlocked(beaten('frostcave', 'magmaforge'), 'sky')).toBe(false);
    expect(islandUnlocked(beaten('frostcave', 'magmaforge', 'drownedcrypt'), 'sky')).toBe(true);
    expect(islandNeeds(none, 'wreck')).toBe('needsOneBoss');
    expect(islandNeeds(none, 'sky')).toBe('needsThreeBosses');
    expect(islandNeeds(none, 'frost')).toBeNull();
  });

  it('gives each island its own ground, and the home island is the one the seed always made', () => {
    expect(worldFor(1234, 'home')).toBe(worldFor(1234, 'home'));
    expect(worldFor(1234, 'home').terrain).toEqual(generateWorld(1234).terrain);
    expect(worldFor(1234, 'frost').island).toBe('frost');
  });

  it('keeps what was built and cut on one island while the hero is on another, and brings it back on return', () => {
    const built = placeStructure(base().structures, 'campfire', 10, 11);
    const home = base({ structures: built, gather: { hp: { 1: 2 }, gone: { 5: 1 } }, respawn: { x: 9, y: 9 } });
    const out = sailTo(home, 'frost');
    expect(out.fx).toEqual([{ t: 'sail', to: 'frost' }]);
    expect(out.session.island).toBe('frost');
    expect(out.session.structures.list).toHaveLength(0);
    expect(out.session.gather).toEqual({ hp: {}, gone: {} });
    const start = worldFor(1234, 'frost').start;
    expect(out.session.respawn).toEqual({ x: start.x + 0.5, y: start.y + 0.5 });
    const back = sailTo(out.session, 'home').session;
    expect(back.island).toBe('home');
    expect(back.structures).toBe(built);
    expect(back.gather).toEqual({ hp: { 1: 2 }, gone: { 5: 1 } });
    expect(back.respawn).toEqual({ x: 9, y: 9 });
    expect(back.stash.frost).toBeDefined();
  });

  it('does nothing for the island the hero is on, or one that is still shut', () => {
    const s = base();
    expect(sailTo(s, 'home')).toEqual({ session: s, fx: [] });
    expect(sailTo(s, 'sky').session).toBe(s);
    expect(sailTo(base({ location: 'grotto' }), 'frost').session.location).toBeNull();
  });
});

describe('the boat', () => {
  const ctx = (over: object = {}) => ({
    world: generateWorld(1234), inv: addItem(emptyInventory(), 'wood', 1).inv, selected: 0, vitals: fullVitals(), pos: { x: 5.5, y: 5.5 },
    facing: 'down' as const, structures: base().structures, farm: emptyFarm(), occupied: new Set<number>(), node: null, creature: false,
    entrance: null, target: null, ...over,
  });

  it('opens the sea chart when used, whether it is a boat the hero built or the dock of a far island', () => {
    const boat = placeStructure(base().structures, 'boat', 5, 6);
    expect(resolveAction(ctx({ structures: boat }))).toMatchObject({ kind: 'boat' });
    expect(resolveAction(ctx({ dock: true }))).toEqual({ kind: 'boat' });
    expect(applyAction(base(), { kind: 'boat' }, { x: 5, y: 5 }).fx).toEqual([{ t: 'voyage' }]);
  });
});
