import { describe, expect, it } from 'vitest';
import { newSlot } from '@/core/saveData';
import { ACHIEVEMENTS, isEarned, newAchievements } from '@/data/achievements';
import { CREATURE_IDS } from '@/data/creatures';
import { UI_STRINGS } from '@/data/strings';
import { addItem, countItem } from '@/sim/inventory';
import { bump } from '@/sim/quests';
import { recordKill, sessionFromSlot, story, type Session } from '@/sim/session';

const slot = () => newSlot(0, 'Ari', 1234, 'normal', { x: 50, y: 50 }, { day: 1, t: 100 }, 1000);
const base = (over: Partial<Session> = {}): Session => ({ ...sessionFromSlot(slot()), ...over });
const text = (x: unknown): string => (typeof x === 'string' ? x : (x as { en: string; id: string }).en + (x as { id: string }).id);

describe('achievements', () => {
  it('have unique ids, titles in both languages and a reward, and none is earned by a fresh game', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(text(a.title).length, a.id).toBeGreaterThan(4);
      expect(text(a.about).length, a.id).toBeGreaterThan(8);
      expect(a.reward, a.id).toBeGreaterThan(0);
      if (a.progress) expect(a.progress(base())[1], a.id).toBeGreaterThan(0);
    }
    expect(newAchievements(base())).toEqual([]);
  });

  it('are earned by the deed and paid in gold once, and the earning is remembered', () => {
    const first = recordKill(base(), 'slime');
    expect(first.fx.map((f) => f.t)).toContain('achievement');
    expect(countItem(first.session.inventory, 'gold')).toBe(10);
    expect(isEarned(first.session, ACHIEVEMENTS.find((a) => a.id === 'first_blood')!)).toBe(true);
    const again = recordKill(first.session, 'slime');
    expect(again.fx.map((f) => f.t)).not.toContain('achievement');
    expect(countItem(again.session.inventory, 'gold')).toBe(10);
  });

  it('count kills, bosses, nights and islands from what the story has raised', () => {
    let s = base();
    for (let i = 0; i < 100; i++) s = { ...s, quests: bump(s.quests, 'kill:slime') };
    expect(newAchievements(s).map((a) => a.id)).toEqual(expect.arrayContaining(['first_blood', 'slayer']));
    expect(newAchievements(s).map((a) => a.id)).not.toContain('exterminator');
    s = { ...s, quests: ['frost', 'ember', 'wreck', 'sky'].reduce((q, i) => bump(q, `island:${i}`), s.quests) };
    expect(newAchievements(s).map((a) => a.id)).toContain('explorer');
    const rich = { ...s, inventory: addItem(s.inventory, 'gold', 999).inv };
    expect(newAchievements(rich).map((a) => a.id)).not.toContain('rich');
    expect(newAchievements({ ...rich, inventory: addItem(rich.inventory, 'gold', 1).inv }).map((a) => a.id)).toContain('rich');
  });

  it('do nothing and cost nothing when nothing has happened', () => {
    const s = base();
    expect(story(s).session).toBe(s);
  });

  it('are listed with a name for every creature of the bestiary', () => {
    for (const id of CREATURE_IDS) expect(UI_STRINGS[`creature_${id}`], id).toBeDefined();
  });
});
