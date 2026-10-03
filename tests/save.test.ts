import { describe, expect, it } from 'vitest';
import { SLOT_COUNT, SaveStore, newSlot, type StorageLike } from '@/core/save';
import { defaultSettings, loadSettings, parseSettings, saveSettings, SETTINGS_KEY } from '@/core/settings';
import { newClock } from '@/sim/daynight';
import { addItem } from '@/sim/inventory';
import { emptyStructures, placeStructure } from '@/sim/structures';
import { till, plant, emptyFarm } from '@/sim/farm';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

const make = (slot = 0, name = 'Ari') => newSlot(slot, name, 4242, 'normal', { x: 77, y: 147 }, newClock(), 1000);

describe('SaveStore', () => {
  it('starts empty', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.list()).toEqual([null, null, null]);
    expect(s.latest()).toBeNull();
    expect(s.load(0)).toBeNull();
  });

  it('round-trips a slot', () => {
    const s = new SaveStore(new MemoryStorage());
    const data = make(1);
    data.inventory = addItem(data.inventory, 'wood', 5).inv;
    data.selected = 2;
    data.vitals = { ...data.vitals, hunger: 40 };
    data.structures = placeStructure(emptyStructures(), 'campfire', 20, 30);
    data.farm = plant(till(emptyFarm(), 5 * 160 + 6), 5 * 160 + 6, 'carrot')!;
    data.gather = { hp: { 3: 2 }, gone: { 9: 4 } };
    s.write(data);
    const back = s.load(1)!;
    expect(back.name).toBe('Ari');
    expect(back.seed).toBe(4242);
    expect(back.inventory[0]).toEqual({ item: 'wood', qty: 5 });
    expect(back.selected).toBe(2);
    expect(back.vitals.hunger).toBe(40);
    expect(back.structures.list).toEqual([{ id: 1, type: 'campfire', x: 20, y: 30 }]);
    expect(back.farm.plots[5 * 160 + 6]).toEqual({ crop: 'carrot', growth: 0, watered: false });
    expect(back.gather).toEqual({ hp: { 3: 2 }, gone: { 9: 4 } });
    expect(back.player).toEqual({ x: 77.5, y: 147.5 });
  });

  it('summarizes slots and finds the latest', () => {
    const s = new SaveStore(new MemoryStorage());
    s.write(make(0, 'First'));
    const later = make(2, 'Second');
    s.write(later);
    const list = s.list();
    expect(list[0]?.name).toBe('First');
    expect(list[1]).toBeNull();
    expect(list[2]?.day).toBe(1);
    expect(s.latest()).not.toBeNull();
  });

  it('falls back to the backup when the main copy is corrupt', () => {
    const mem = new MemoryStorage();
    const s = new SaveStore(mem);
    s.write(make(0, 'Old'));
    s.write(make(0, 'New'));
    mem.setItem('tidewake.slot.0', '{not json');
    expect(s.load(0)?.name).toBe('Old');
  });

  it('returns null when both copies are corrupt', () => {
    const mem = new MemoryStorage();
    const s = new SaveStore(mem);
    s.write(make(0));
    s.write(make(0));
    mem.setItem('tidewake.slot.0', 'x');
    mem.setItem('tidewake.slot.0.bak', 'y');
    expect(s.load(0)).toBeNull();
  });

  it('deletes both the save and its backup', () => {
    const mem = new MemoryStorage();
    const s = new SaveStore(mem);
    s.write(make(0));
    s.write(make(0));
    s.delete(0);
    expect(s.load(0)).toBeNull();
    expect(mem.data.size).toBe(0);
  });

  it('rejects slot numbers outside the range', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(() => s.load(SLOT_COUNT)).toThrow(RangeError);
    expect(() => s.load(-1)).toThrow(RangeError);
    expect(() => s.write(make(5))).toThrow(RangeError);
  });

  it('mirrors every write to the durable store and can restore from it', async () => {
    const mirror = new Map<string, string>();
    const a = new SaveStore(new MemoryStorage(), (k, v) => mirror.set(k, v));
    a.write(make(1, 'Mirrored'));
    expect(mirror.has('tidewake.slot.1')).toBe(true);
    const fresh = new SaveStore(new MemoryStorage());
    await fresh.restoreFromNative(async (k) => mirror.get(k) ?? null);
    expect(fresh.load(1)?.name).toBe('Mirrored');
  });

  it('offers the first empty slot for a new game, then the oldest one', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.slotForNewGame()).toEqual({ slot: 0, overwrites: false });
    s.write(make(0));
    expect(s.slotForNewGame()).toEqual({ slot: 1, overwrites: false });
    s.write(make(1));
    s.write(make(2));
    const oldest = new SaveStore(new MemoryStorage());
    for (const slot of [2, 0, 1]) {
      const data = make(slot);
      oldest.write(data);
      const stored = JSON.parse((oldest as unknown as { storage: StorageLike }).storage.getItem(`tidewake.slot.${slot}`)!);
      stored.updatedAt = 1000 + (slot === 1 ? 0 : 500);
      (oldest as unknown as { storage: StorageLike }).storage.setItem(`tidewake.slot.${slot}`, JSON.stringify(stored));
    }
    expect(oldest.slotForNewGame()).toEqual({ slot: 1, overwrites: true });
  });

  it('works without any storage', () => {
    const s = new SaveStore(null);
    expect(() => s.write(make(0))).not.toThrow();
    expect(s.load(0)).toBeNull();
  });
});

describe('settings', () => {
  it('returns defaults when nothing is stored or the data is corrupt', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(defaultSettings());
    const mem = new MemoryStorage();
    mem.setItem(SETTINGS_KEY, '{oops');
    expect(loadSettings(mem)).toEqual(defaultSettings());
  });

  it('round-trips and clamps volumes', () => {
    const mem = new MemoryStorage();
    saveSettings(mem, { ...defaultSettings(), musicVol: 0.2, lang: 'id', joystick: 'fixed' });
    expect(loadSettings(mem)).toMatchObject({ musicVol: 0.2, lang: 'id', joystick: 'fixed' });
    expect(parseSettings({ musicVol: 7, sfxVol: -2 }).musicVol).toBe(1);
    expect(parseSettings({ musicVol: 7, sfxVol: -2 }).sfxVol).toBe(0);
  });

  it('defaults to automatic quality and clamps the text scale', () => {
    expect(defaultSettings().quality).toBe('auto');
    expect(parseSettings({ quality: 'low' }).quality).toBe('low');
    expect(parseSettings({ quality: 'ultra' }).quality).toBe('auto');
    expect(parseSettings({ textScale: 5 }).textScale).toBe(1.3);
    expect(parseSettings({ textScale: 0.2 }).textScale).toBe(1);
    expect(parseSettings({ textScale: 'big' }).textScale).toBe(1);
  });

  it('ignores unknown keys and wrong types', () => {
    const s = parseSettings({ vibration: 'yes', bogus: 1, lang: 'fr' }, 'id');
    expect(s.vibration).toBe(true);
    expect(s.lang).toBe('id');
    expect('bogus' in s).toBe(false);
  });
});
