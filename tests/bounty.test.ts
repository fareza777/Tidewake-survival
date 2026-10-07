import { describe, expect, it } from 'vitest';
import { newSlot, parseSlot } from '@/core/saveData';
import { BOUNTIES } from '@/data/bounties';
import { CREATURES } from '@/data/creatures';
import { ITEMS } from '@/data/items';
import { NPC_IDS } from '@/data/npcs';
import { UI_STRINGS } from '@/data/strings';
import { addItem, countItem } from '@/sim/inventory';
import { acceptBounty, bountyProgress, dropBounty, offerFor, parseBounty, turnInBounty, wantedName } from '@/sim/bounty';
import { bump } from '@/sim/quests';
import { sessionFromSlot, sessionToSlot, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 3, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });

describe('bounty boards', () => {
  it('only ask for things that exist, and have a name in both languages', () => {
    for (const [npc, pool] of Object.entries(BOUNTIES)) {
      expect(NPC_IDS).toContain(npc);
      expect(pool!.length, npc).toBeGreaterThanOrEqual(5);
      for (const w of pool!) {
        expect(w.min, `${npc} ${w.target}`).toBeLessThanOrEqual(w.max);
        expect(w.unit).toBeGreaterThan(0);
        if (w.kind === 'hunt') expect(CREATURES[w.target], w.target).toBeDefined();
        else expect(ITEMS[w.target], w.target).toBeDefined();
        expect(UI_STRINGS[wantedName(w)], `${npc} ${w.target}`).toBeDefined();
      }
    }
  });

  it('post the same job all day and another one the next day', () => {
    const a = offerFor(1234, 'marlo', 3)!;
    expect(offerFor(1234, 'marlo', 3)).toEqual(a);
    const seen = new Set(Array.from({ length: 12 }, (_, d) => JSON.stringify(offerFor(1234, 'marlo', d + 1))));
    expect(seen.size).toBeGreaterThan(5);
    expect(offerFor(1234, 'tali', 3)).toBeNull();
  });
});

describe('taking and finishing a bounty', () => {
  const fetchDay = (): { s: Session; day: number } => {
    for (let day = 1; day < 60; day++) if (offerFor(1234, 'marlo', day)?.kind === 'fetch') return { s: base({ clock: { day, t: 100 } }), day };
    throw new Error('no fetch job in sixty days');
  };
  const huntDay = (): Session => {
    for (let day = 1; day < 60; day++) if (offerFor(1234, 'marlo', day)?.kind === 'hunt') return base({ clock: { day, t: 100 } });
    throw new Error('no hunt in sixty days');
  };

  it('takes one job at a time', () => {
    const s = acceptBounty(huntDay(), 'marlo').session;
    expect(s.bounty).not.toBeNull();
    const again = acceptBounty(s, 'marlo');
    expect(again.session).toBe(s);
    expect(again.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgBountyBusy']);
    expect(dropBounty(s).bounty).toBeNull();
    expect(acceptBounty(base(), 'tali').session.bounty).toBeNull();
  });

  it('counts only the kills that follow the day it was taken, and pays gold for them', () => {
    let s = acceptBounty({ ...huntDay(), quests: bump(huntDay().quests, 'kill:slime', 20) }, 'marlo').session;
    const b = s.bounty!;
    expect(b.kind).toBe('hunt');
    const before = s.quests.counters[`kill:${b.target}`] ?? 0;
    expect(before).toBe(b.base);
    expect(bountyProgress(s)).toEqual([0, b.n]);
    expect(turnInBounty(s).session).toBe(s);
    s = { ...s, quests: bump(s.quests, `kill:${b.target}`, b.n) };
    expect(bountyProgress(s)).toEqual([b.n, b.n]);
    const r = turnInBounty(s);
    expect(r.session.bounty).toBeNull();
    expect(countItem(r.session.inventory, 'gold')).toBeGreaterThanOrEqual(b.reward);
    expect(r.session.quests.counters.bounty).toBe(1);
  });

  it('takes the goods of a fetch job and gives the trader only one job a day', () => {
    const { s: day, day: d } = fetchDay();
    let s = acceptBounty(day, 'marlo').session;
    const b = s.bounty!;
    expect(b.kind).toBe('fetch');
    expect(turnInBounty(s).session).toBe(s);
    s = { ...s, inventory: addItem(s.inventory, b.target as 'wood', b.n + 2).inv };
    const r = turnInBounty(s);
    expect(countItem(r.session.inventory, b.target as 'wood')).toBe(2);
    expect(r.session.bounty).toBeNull();
    const second = acceptBounty(r.session, 'marlo');
    expect(second.session.bounty).toBeNull();
    expect(second.fx.map((f) => f.t === 'say' && f.key)).toEqual(['msgBountyDone']);
    expect(acceptBounty({ ...r.session, clock: { day: d + 1, t: 100 } }, 'marlo').session.bounty).not.toBeNull();
  });

  it('is saved with the game, and a damaged one is dropped', () => {
    const s = acceptBounty(huntDay(), 'marlo').session;
    const back = parseSlot(JSON.parse(JSON.stringify(sessionToSlot(slot(), s, { x: 1, y: 1 }))), 0)!;
    expect(back.bounty).toEqual(s.bounty);
    expect(parseBounty({ ...s.bounty, target: 'dragon' })).toBeNull();
    expect(parseBounty({ ...s.bounty, n: 0 })).toBeNull();
    expect(parseBounty({ ...s.bounty, npc: 'nobody' })).toBeNull();
    expect(parseBounty('x')).toBeNull();
  });
});
