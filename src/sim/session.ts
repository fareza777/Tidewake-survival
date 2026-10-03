import { Rng, hashString } from '@/core/rng';
import type { SaveSlot } from '@/core/saveData';
import { ITEMS, type ItemId } from '@/data/items';
import type { Recipe } from '@/data/recipes';
import type { Station } from '@/data/structures';
import type { Action } from '@/sim/actions';
import { advance, canSleep, wakeUp, type Clock } from '@/sim/daynight';
import { applyDeath } from '@/sim/death';
import * as farmSim from '@/sim/farm';
import { hitNode, startNewDay, type GatherState } from '@/sim/gather';
import {
  addItem, moveSlot, setDurability, takeOne, wearTool, type Inventory, type Slot,
} from '@/sim/inventory';
import { craft } from '@/sim/crafting';
import type { Vec } from '@/sim/movement';
import { placeStructure, removeStructure, setStructureInventory, type Structure, type Structures } from '@/sim/structures';
import { eat, sleepRecovery, spendStamina, tickVitals, type Difficulty, type Vitals } from '@/sim/vitals';
import { idx, type Biome } from '@/sim/world/types';

/** The live game state that changes while playing. Pure data: every function here returns a new Session. */
export interface Session {
  seed: number;
  difficulty: Difficulty;
  clock: Clock;
  gather: GatherState;
  inventory: Inventory;
  selected: number;
  vitals: Vitals;
  structures: Structures;
  farm: farmSim.Farm;
  respawn: Vec;
  playTime: number;
}

/** Something the scene should show or do as a result of a rule: floating text, a sprite change, a dialog. */
export type Fx =
  | { t: 'say'; key: string; vars?: Record<string, string | number>; /** Variables that are i18n keys to translate. */ translate?: string[] }
  | { t: 'gain'; item: ItemId; qty: number }
  | { t: 'swing' }
  | { t: 'hit'; id: number }
  | { t: 'gone'; id: number }
  | { t: 'built'; structure: Structure }
  | { t: 'unbuilt'; id: number }
  | { t: 'plot'; tile: number }
  | { t: 'open'; structure: Structure }
  | { t: 'slept' };

export interface Step {
  session: Session;
  fx: Fx[];
}

export function sessionFromSlot(slot: SaveSlot): Session {
  return {
    seed: slot.seed, difficulty: slot.difficulty, clock: slot.clock, gather: slot.gather, inventory: slot.inventory,
    selected: slot.selected, vitals: slot.vitals, structures: slot.structures, farm: slot.farm, respawn: slot.respawn,
    playTime: slot.playTimeSec,
  };
}

/** Merge the live state back into a slot record for saving. */
export function sessionToSlot(base: SaveSlot, s: Session, pos: Vec): SaveSlot {
  return {
    ...base, player: { x: pos.x, y: pos.y }, respawn: s.respawn, clock: s.clock, gather: s.gather, inventory: s.inventory,
    selected: s.selected, vitals: s.vitals, structures: s.structures, farm: s.farm, playTimeSec: s.playTime,
  };
}

/** Advance time: the clock runs and the vital meters drain or recover. */
export function tickSession(s: Session, dt: number, biome: Biome, busy: boolean): Session {
  return {
    ...s,
    clock: advance(s.clock, dt),
    playTime: s.playTime + dt,
    vitals: tickVitals(s.vitals, dt, { difficulty: s.difficulty, biome, busy }),
  };
}

/** A new in-game day: nodes regrow (unless `keepGone` holds them back) and watered crops grow. */
export function rollDay(s: Session, keepGone: (id: number) => boolean): Session {
  return { ...s, gather: startNewDay(s.gather, s.clock.day, keepGone), farm: farmSim.advanceDay(s.farm) };
}

export function selectSlot(s: Session, index: number): Session {
  return index >= 0 && index < 8 ? { ...s, selected: index } : s;
}

const say = (key: string, vars?: Record<string, string | number>, translate?: string[]): Fx => ({ t: 'say', key, vars, translate });

function giveItems(inv: Inventory, items: { item: ItemId; qty: number }[]): { inv: Inventory; fx: Fx[] } {
  const fx: Fx[] = [];
  let cur = inv;
  let overflow = false;
  for (const it of items) {
    const { inv: next, left } = addItem(cur, it.item, it.qty);
    cur = next;
    if (it.qty - left > 0) fx.push({ t: 'gain', item: it.item, qty: it.qty - left });
    if (left > 0) overflow = true;
  }
  if (overflow) fx.push(say('msgFull'));
  return { inv: cur, fx };
}

function blockedFx(a: Extract<Action, { kind: 'blocked' }>): Fx[] {
  switch (a.reason) {
    case 'needsTool': return [say('msgNeedsTool', { tool: `tool_${a.tool}`, tier: a.tier }, ['tool'])];
    case 'tired': return [say('msgTired')];
    case 'saltWater': return [say('msgSaltWater')];
    case 'canEmpty': return [say('msgCanEmpty')];
    case 'chestNotEmpty': return [say('msgChestNotEmpty')];
    case 'cannotPlace': return [say(`msgPlace_${a.why}`)];
  }
}

/** Carry out an action the resolver chose. `pos` is where the hero stands (used for the respawn point). */
export function applyAction(s: Session, a: Action, pos: Vec): Step {
  const slotBefore = s.inventory[s.selected];
  switch (a.kind) {
    case 'none': return { session: s, fx: [] };
    case 'blocked': return { session: s, fx: blockedFx(a) };
    case 'hit': {
      const rng = new Rng(hashString(`${s.seed}:${a.node.id}:${s.gather.hp[a.node.id] ?? 'full'}`));
      const result = hitNode(s.gather, a.node, a.damage, s.clock.day, rng);
      const worn = a.wear ? wearTool(s.inventory, s.selected) : s.inventory;
      const given = giveItems(worn, result.drops.map((d) => ({ item: d.item, qty: d.amount })));
      const fx: Fx[] = [{ t: 'swing' }, { t: 'hit', id: a.node.id }];
      if (result.destroyed) fx.push({ t: 'gone', id: a.node.id });
      if (slotBefore && !worn[s.selected]) fx.push(say('msgToolBroke', { item: `item_${slotBefore.item}` }, ['item']));
      return {
        session: { ...s, gather: result.state, inventory: given.inv, vitals: spendStamina(s.vitals, a.stamina) ?? s.vitals },
        fx: [...fx, ...given.fx],
      };
    }
    case 'place': {
      const structures = placeStructure(s.structures, a.type, a.x, a.y);
      return {
        session: { ...s, structures, inventory: takeOne(s.inventory, s.selected) },
        fx: [{ t: 'built', structure: structures.list[structures.list.length - 1] }],
      };
    }
    case 'pickup': {
      const { inv, left } = addItem(s.inventory, a.structure.type, 1);
      if (left > 0) return { session: s, fx: [say('msgFull')] };
      return {
        session: { ...s, inventory: inv, structures: removeStructure(s.structures, a.structure.id) },
        fx: [{ t: 'unbuilt', id: a.structure.id }, { t: 'gain', item: a.structure.type, qty: 1 }],
      };
    }
    case 'till': {
      const tile = idx(a.x, a.y);
      return {
        session: { ...s, farm: farmSim.till(s.farm, tile), inventory: wearTool(s.inventory, s.selected), vitals: spendStamina(s.vitals, a.stamina) ?? s.vitals },
        fx: [{ t: 'swing' }, { t: 'plot', tile }],
      };
    }
    case 'plant': {
      const tile = idx(a.x, a.y);
      const farm = farmSim.plant(s.farm, tile, a.crop);
      if (!farm) return { session: s, fx: [] };
      return { session: { ...s, farm, inventory: takeOne(s.inventory, s.selected) }, fx: [{ t: 'plot', tile }] };
    }
    case 'water': {
      const tile = idx(a.x, a.y);
      return { session: { ...s, farm: farmSim.water(s.farm, tile), inventory: wearTool(s.inventory, s.selected) }, fx: [{ t: 'swing' }, { t: 'plot', tile }] };
    }
    case 'refill': {
      const cap = ITEMS.watering_can.tool?.durability ?? 0;
      return { session: { ...s, inventory: setDurability(s.inventory, s.selected, cap) }, fx: [say('msgFilled')] };
    }
    case 'eat':
      return { session: { ...s, inventory: takeOne(s.inventory, s.selected), vitals: eat(s.vitals, a.food) }, fx: [] };
    case 'harvest': {
      const tile = idx(a.x, a.y);
      const rng = new Rng(hashString(`${s.seed}:farm:${tile}:${s.clock.day}`));
      const result = farmSim.harvest(s.farm, tile, rng);
      if (!result) return { session: s, fx: [] };
      const given = giveItems(s.inventory, result.items);
      return { session: { ...s, farm: result.farm, inventory: given.inv }, fx: [{ t: 'plot', tile }, ...given.fx] };
    }
    case 'drink':
      return { session: { ...s, vitals: eat(s.vitals, { hunger: 0, thirst: 25, hp: 0 }) }, fx: [say('msgDrank')] };
    case 'open':
      return { session: s, fx: [{ t: 'open', structure: a.structure }] };
    case 'sleep': {
      const respawn = { x: pos.x, y: pos.y };
      if (!canSleep(s.clock)) return { session: { ...s, respawn }, fx: [say('msgSleepDay')] };
      return {
        session: { ...s, respawn, clock: wakeUp(s.clock), vitals: sleepRecovery(s.vitals) },
        fx: [{ t: 'slept' }, say('msgSleepNight')],
      };
    }
  }
}

/** Craft one batch at the stations in reach. Nothing changes when it is not possible. */
export function craftRecipe(s: Session, recipe: Recipe, near: ReadonlySet<Station>): Step {
  const inv = craft(s.inventory, recipe, near);
  if (!inv) return { session: s, fx: [] };
  return { session: { ...s, inventory: inv }, fx: [{ t: 'gain', item: recipe.out, qty: recipe.qty }] };
}

export function moveInventorySlot(s: Session, from: number, to: number): Session {
  return { ...s, inventory: moveSlot(s.inventory, from, to) };
}

/** Put a stack into an inventory; a tool keeps its wear. `left` is what did not fit. */
function putStack(inv: Inventory, slot: Slot): { inv: Inventory; left: number } {
  if (slot.dur === undefined) return addItem(inv, slot.item, slot.qty);
  const free = inv.indexOf(null);
  if (free < 0) return { inv, left: slot.qty };
  return { inv: inv.map((x, i) => (i === free ? slot : x)), left: 0 };
}

/** Move a whole stack between the backpack and a chest; whatever does not fit stays where it was. */
export function transferStack(s: Session, chestId: number, from: 'bag' | 'chest', index: number): Step {
  const chest = s.structures.list.find((p) => p.id === chestId);
  if (!chest?.inv) return { session: s, fx: [] };
  const source = from === 'bag' ? s.inventory : chest.inv;
  const slot = source[index];
  if (!slot) return { session: s, fx: [] };
  const target = from === 'bag' ? chest.inv : s.inventory;
  const { inv: filled, left } = putStack(target, slot);
  if (left === slot.qty) return { session: s, fx: [say('msgFull')] };
  const emptied = source.map((x, i) => (i === index ? (left > 0 ? { ...slot, qty: left } : null) : x));
  const bag = from === 'bag' ? emptied : filled;
  const chestInv = from === 'bag' ? filled : emptied;
  return { session: { ...s, inventory: bag, structures: setStructureInventory(s.structures, chestId, chestInv) }, fx: [] };
}

export interface Death {
  session: Session;
  /** Hardcore: delete the save and return to the menu. */
  wipeSave: boolean;
}

/** The hero collapsed: apply the difficulty's penalty and wake up at the respawn point. */
export function collapse(s: Session, roll: () => number): Death {
  const result = applyDeath(s.difficulty, s.inventory, roll);
  return { session: { ...s, inventory: result.inv, vitals: result.vitals }, wipeSave: result.wipeSave };
}
