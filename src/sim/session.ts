import { Rng, hashString } from '@/core/rng';
import type { SaveSlot } from '@/core/saveData';
import { ITEMS, type ItemId, type WeaponStats } from '@/data/items';
import type { Recipe } from '@/data/recipes';
import type { Station } from '@/data/structures';
import type { Action } from '@/sim/actions';
import { advance, canSleep, wakeUp, type Clock } from '@/sim/daynight';
import { applyDeath } from '@/sim/death';
import { emptyProgress, type DungeonId, type DungeonProgress, type Dungeons } from '@/sim/dungeon/progress';
import { lootChest, unlockDoor } from '@/sim/dungeon/rules';
import type { Chest, Door } from '@/sim/dungeon/types';
import { equipFromSlot, unequipSlot, type Equipment } from '@/sim/equipment';
import type { GearSlot } from '@/data/items';
import { addBuff, pruneBuffs, removeBuff, type Buff } from '@/sim/buffs';
import { climateAt, shelteredAt } from '@/sim/climate';
import { CRIT_DAMAGE, modsOf, type Mods } from '@/sim/mods';
import { isWet, seasonOf, strainOf, weatherAt, type Strain } from '@/sim/weather';
import { gainXp, levelOf, type SkillId, type Skills } from '@/sim/skills';
import { repairSlot, upgradeSlot } from '@/sim/upgrade';
import { CREATURES, type CreatureId } from '@/data/creatures';
import * as farmSim from '@/sim/farm';
import { hitNode, startNewDay, type GatherState } from '@/sim/gather';
import {
  addItem, countItem, moveSlot, removeItem, setDurability, takeOne, wearTool, type Inventory, type Slot,
} from '@/sim/inventory';
import type { Melee } from '@/sim/melee';
import { craft } from '@/sim/crafting';
import type { Vec } from '@/sim/movement';
import { placeStructure, removeStructure, setStructureInventory, structureAt, type Structure, type Structures } from '@/sim/structures';
import { COOKED_FOODS } from '@/data/items';
import type { Text } from '@/sim/quests';
import type { QuestEvent, QuestState } from '@/sim/quests';
import { giveItems, say } from '@/sim/sessionKit';
import { arrive, chooseEnding, claimOwed, dawn, dig, fish, inspect, reached, recordKill, story, talk, useRaft, withStory } from '@/sim/storySession';
import { eat, sleepRecovery, spendStamina, takeDamage, tickVitals, type Difficulty, type Vitals } from '@/sim/vitals';
import { freshStash, islandUnlocked, worldFor, type Stashes } from '@/sim/islands';
import type { Job } from '@/data/settlers';
import type { Store } from '@/sim/settlers';
import type { Bounty } from '@/sim/bounty';
import { pressureOf } from '@/sim/ngScale';
import { idx, type Biome, type IslandId, type ResourceNode } from '@/sim/world/types';

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
  /** The dungeon the hero is in, or null on the island. */
  location: DungeonId | null;
  equipment: Equipment;
  dungeons: Dungeons;
  /** Quest progress: the chapters, the side quests, what has happened and what has been found. */
  quests: QuestState;
  /** Experience in each skill. */
  skills: Skills;
  /** Lasting effects: food, potions, poison. */
  buffs: readonly Buff[];
  /** The last day a night raid was rolled for. */
  raidDay: number;
  /** The island the hero is on; `gather`, `structures`, `farm` and `respawn` belong to it. */
  island: IslandId;
  /** The same four things for the islands he has left. */
  stash: Stashes;
  /** The people who work for him, one trade each. */
  settlers: readonly Job[];
  /** What they have brought in and nobody has taken yet. */
  store: Store;
  /** The job a trader posted that the hero has taken, if any. */
  bounty: Bounty | null;
  /** Rounds of New Game+ already finished (0 on the first run). */
  ng: number;
  /** The floor of the Endless Depths the hero is on (when he is there). */
  floor: number;
}

/** Something the scene should show or do as a result of a rule: floating text, a sprite change, a dialog. */
export type Fx =
  | { t: 'say'; key: string; vars?: Record<string, string | number>; /** Variables that are i18n keys to translate. */ translate?: string[] }
  | { t: 'gain'; item: ItemId; qty: number }
  | { t: 'swing' }
  | { t: 'strike'; melee: Melee; /** A critical blow. */ crit?: boolean }
  | { t: 'shot'; stats: WeaponStats }
  | { t: 'hit'; id: number }
  | { t: 'gone'; id: number }
  | { t: 'built'; structure: Structure }
  | { t: 'unbuilt'; id: number }
  | { t: 'plot'; tile: number }
  | { t: 'open'; structure: Structure }
  | { t: 'slept' }
  | { t: 'ate' }
  | { t: 'equipped' }
  | { t: 'travel'; to: DungeonId | null }
  | { t: 'voyage' }
  | { t: 'sail'; to: IslandId }
  | { t: 'chestOpened'; id: number }
  | { t: 'doorOpened'; id: number }
  | { t: 'quest'; ev: QuestEvent }
  | { t: 'dialog'; speaker: Text | null; lines: readonly Text[] }
  | { t: 'levelUp'; skill: SkillId; level: number }
  | { t: 'achievement'; id: string }
  | { t: 'upgraded'; item: ItemId; plus: number }
  | { t: 'ending' }
  | { t: 'theEnd'; which: 'A' | 'B' };

export interface Step {
  session: Session;
  fx: Fx[];
}

export function sessionFromSlot(slot: SaveSlot): Session {
  return {
    seed: slot.seed, difficulty: slot.difficulty, clock: slot.clock, gather: slot.gather, inventory: slot.inventory,
    selected: slot.selected, vitals: slot.vitals, structures: slot.structures, farm: slot.farm, respawn: slot.respawn,
    playTime: slot.playTimeSec, location: slot.location, equipment: slot.equipment, dungeons: slot.dungeons, quests: slot.quests,
    skills: slot.skills, buffs: slot.buffs, raidDay: slot.raidDay, island: slot.island, stash: slot.stash,
    settlers: slot.settlers, store: slot.store, bounty: slot.bounty, ng: slot.ng, floor: slot.floor,
  };
}

/** Merge the live state back into a slot record for saving. */
export function sessionToSlot(base: SaveSlot, s: Session, pos: Vec): SaveSlot {
  return {
    ...base, player: { x: pos.x, y: pos.y }, respawn: s.respawn, clock: s.clock, gather: s.gather, inventory: s.inventory,
    selected: s.selected, vitals: s.vitals, structures: s.structures, farm: s.farm, playTimeSec: s.playTime,
    location: s.location, equipment: s.equipment, dungeons: s.dungeons, quests: s.quests, skills: s.skills, buffs: [...s.buffs], raidDay: s.raidDay,
    island: s.island, stash: s.stash, settlers: [...s.settlers], store: s.store, bounty: s.bounty, ng: s.ng, floor: s.floor,
  };
}

/** What his skills and gear add to what he does. */
let modsMemo: { skills: Skills; equipment: Equipment; buffs: readonly Buff[]; mods: Mods } | null = null;
export function sessionMods(s: Session): Mods {
  if (modsMemo && modsMemo.skills === s.skills && modsMemo.equipment === s.equipment && modsMemo.buffs === s.buffs) return modsMemo.mods;
  const mods = modsOf(s.skills, s.equipment, s.buffs);
  modsMemo = { skills: s.skills, equipment: s.equipment, buffs: s.buffs, mods };
  return mods;
}

/** Give experience in one or more skills; a level reached is announced. */
function withXp(step: Step, gains: readonly (readonly [SkillId, number])[]): Step {
  let skills = step.session.skills;
  const fx = [...step.fx];
  for (const [id, n] of gains) {
    const g = gainXp(skills, id, n);
    skills = g.skills;
    if (g.leveledTo !== null) fx.push({ t: 'levelUp', skill: id, level: g.leveledTo });
  }
  return skills === step.session.skills ? step : { session: { ...step.session, skills }, fx };
}

/** Experience for a kill: the tougher the creature, the more. */
export function rewardKill(s: Session, kind: CreatureId): Step {
  const def = CREATURES[kind];
  const xp = Math.max(2, Math.round(def.hp / 2)) * (def.temper === 'boss' ? 3 : 1);
  return withXp({ session: s, fx: [] }, [['combat', xp]]);
}

/** Cross the sea: what he did here is kept, and the other island's is taken up. Nothing changes when the way is shut. */
export function sailTo(s: Session, to: IslandId): Step {
  if (to === s.island || !islandUnlocked(s.dungeons, to)) return { session: s, fx: [] };
  const here = { gather: s.gather, structures: s.structures, farm: s.farm, respawn: s.respawn };
  const next = s.stash[to] ?? freshStash(worldFor(s.seed, to).start);
  return {
    session: {
      ...s, island: to, location: null, gather: next.gather, structures: next.structures, farm: next.farm, respawn: next.respawn,
      stash: { ...s.stash, [s.island]: here },
    },
    fx: [{ t: 'sail', to }],
  };
}

const NO_STRAIN: Strain = { thirst: 1, regen: 1, speed: 1 };

/** What the weather under the open sky does to the hero right now (nothing underground). */
export function weatherStrain(s: Session, biome: Biome): Strain {
  return s.location === null ? strainOf(seasonOf(s.clock.day), weatherAt(s.seed, s.clock.day, s.clock.t), biome) : NO_STRAIN;
}

/** Advance time: the clock runs and the vital meters drain or recover. */
export function tickSession(s: Session, dt: number, biome: Biome, busy: boolean, running = false, pos?: Vec): Session {
  const playTime = s.playTime + dt;
  const buffs = pruneBuffs(s.buffs, playTime);
  const live = buffs === s.buffs ? s : { ...s, buffs };
  const m = sessionMods(live);
  // The cold only matters out in the open air (and the hero's position must be known).
  const strain = weatherStrain(live, biome);
  const climate = pos && s.location === null ? climateAt(s.seed, s.clock, s.structures, pos, biome) : null;
  return {
    ...live,
    clock: advance(s.clock, dt),
    playTime,
    vitals: tickVitals(s.vitals, dt, {
      difficulty: s.difficulty, biome, busy, running, regen: m.regen, hpRegen: m.hpRegen, hpDrain: m.hpDrain,
      cold: climate?.cold ?? 0, heated: climate?.heated ?? false, sheltered: climate?.sheltered ?? false, protect: m.warmth,
      thirstMul: strain.thirst, regenMul: strain.regen,
    }),
  };
}

/** A new in-game day: nodes regrow (unless `keepGone` holds them back) and watered crops grow. */
export function rollDay(s: Session, keepGone: (id: number) => boolean): Session {
  // Rain waters the fields; in winter nothing grows.
  const watered = isWet(weatherAt(s.seed, s.clock.day, 0)) ? farmSim.waterAll(s.farm) : s.farm;
  const farm = seasonOf(s.clock.day) === 'winter' ? farmSim.dryOut(watered) : farmSim.advanceDay(watered);
  return { ...s, gather: startNewDay(s.gather, s.clock.day, keepGone), farm };
}

/** A chopped node must not regrow on a tile the player has since built on or tilled. */
export function blocksRegrowth(s: Session, node: ResourceNode, size: number): boolean {
  return structureAt(s.structures, node.x, node.y) !== undefined || idx(node.x, node.y, size) in s.farm.plots;
}

/** Change the progress of the dungeon the hero is in. The very same session comes back when there is no change. */
export function updateDungeon(s: Session, change: (p: DungeonProgress) => DungeonProgress): Session {
  if (!s.location) return s;
  const before = s.dungeons[s.location];
  const after = change(before);
  return after === before ? s : { ...s, dungeons: { ...s.dungeons, [s.location]: after } };
}

function openChest(s: Session, chest: Chest): Step {
  if (!s.location || s.dungeons[s.location].looted.includes(chest.id)) return { session: s, fx: [] };
  const paid = chest.locked ? removeItem(s.inventory, 'small_key', 1) : s.inventory;
  if (!paid) return { session: s, fx: [] };
  const given = giveItems(paid, chest.loot.map((l) => ({ item: l.item, qty: l.qty })));
  if (given.overflow) return { session: s, fx: [say('msgFull')] };
  const session = updateDungeon({ ...s, inventory: given.inv }, (p) => lootChest(p, chest.id));
  return { session, fx: [{ t: 'chestOpened', id: chest.id }, ...given.fx] };
}

function openBossDoor(s: Session, door: Door): Step {
  const paid = s.location ? removeItem(s.inventory, 'boss_key', 1) : null;
  if (!paid) return { session: s, fx: [] };
  return { session: updateDungeon({ ...s, inventory: paid }, (p) => unlockDoor(p, door.id)), fx: [{ t: 'doorOpened', id: door.id }] };
}

/** Put the armour in a backpack slot on; whatever was worn goes back into that slot. */
export function equipArmor(s: Session, index: number): Step {
  const worn = equipFromSlot(s.inventory, s.equipment, index);
  return worn ? { session: { ...s, inventory: worn.inv, equipment: worn.equipment }, fx: [{ t: 'equipped' }] } : { session: s, fx: [] };
}

/** Take the body armour off into the backpack. */
export const takeOffArmor = (s: Session): Step => takeOffGear(s, 'armor');

/** A blow from a creature: hit points are lost, nothing else. */
export function hurtHero(s: Session, amount: number): Session {
  return amount > 0 ? { ...s, vitals: takeDamage(s.vitals, amount) } : s;
}

export function selectSlot(s: Session, index: number): Session {
  return index >= 0 && index < 8 ? { ...s, selected: index } : s;
}

/** The "your tool broke" message when the held slot emptied by wear. */
function brokeFx(before: Slot | null | undefined, after: Inventory, index: number): Fx[] {
  return before && !after[index] ? [say('msgToolBroke', { item: `item_${before.item}` }, ['item'])] : [];
}

function blockedFx(a: Extract<Action, { kind: 'blocked' }>): Fx[] {
  switch (a.reason) {
    case 'needsTool': return [say('msgNeedsTool', { tool: `tool_${a.tool}`, tier: a.tier }, ['tool'])];
    case 'tired': return [say('msgTired')];
    case 'saltWater': return [say('msgSaltWater')];
    case 'canEmpty': return [say('msgCanEmpty')];
    case 'noArrows': return [say('msgNoArrows')];
    case 'needsKey': return [say('msgNeedsKey')];
    case 'needsBossKey': return [say('msgNeedsBossKey')];
    case 'needsLighthouseKey': return [say('msgNeedsLighthouseKey')];
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
      const mods = sessionMods(s);
      const wood = a.node.kind === 'tree' || a.node.kind === 'palm' || a.node.kind === 'swamptree' || a.node.kind === 'bush';
      // Skill and luck: now and then the last blow yields one more of the main drop.
      const extra = result.destroyed && result.drops.length > 0 && rng.chance(wood ? mods.yieldWood : mods.yieldMine)
        ? [{ item: result.drops[0].item, qty: 1 }] : [];
      const given = giveItems(worn, [...result.drops.map((d) => ({ item: d.item, qty: d.amount })), ...extra]);
      // The last blow would throw the drops away: the node stands until there is room.
      if (result.destroyed && given.overflow) return { session: s, fx: [say('msgFull')] };
      const fx: Fx[] = [{ t: 'swing' }, { t: 'hit', id: a.node.id }];
      if (result.destroyed) fx.push({ t: 'gone', id: a.node.id });
      const skill: SkillId = wood ? 'woodcutting' : 'mining';
      const base = a.node.kind === 'ore' ? 5 : a.node.kind === 'crystal' ? 8 : 3;
      return withXp({
        session: { ...s, gather: result.state, inventory: given.inv, vitals: spendStamina(s.vitals, a.stamina) ?? s.vitals },
        fx: [...fx, ...brokeFx(slotBefore, worn, s.selected), ...given.fx],
      }, [[skill, base + (result.destroyed ? base * 2 : 0)]]);
    }
    case 'attack': {
      const worn = a.melee.wear ? wearTool(s.inventory, s.selected) : s.inventory;
      const crit = new Rng(hashString(`${s.seed}:crit:${Math.floor(s.playTime * 20)}`)).chance(sessionMods(s).crit);
      const hit = a.melee.damage / pressureOf(s);
      const melee = crit ? { ...a.melee, damage: hit * CRIT_DAMAGE } : { ...a.melee, damage: hit };
      return {
        session: { ...s, inventory: worn, vitals: spendStamina(s.vitals, a.melee.stamina) ?? s.vitals },
        fx: [{ t: 'swing' }, { t: 'strike', melee, crit }, ...brokeFx(slotBefore, worn, s.selected)],
      };
    }
    case 'shoot': {
      const spent = removeItem(s.inventory, 'arrow', 1);
      if (!spent) return { session: s, fx: [say('msgNoArrows')] };
      const worn = wearTool(spent, s.selected);
      return {
        session: { ...s, inventory: worn, vitals: spendStamina(s.vitals, a.stats.stamina) ?? s.vitals },
        fx: [{ t: 'swing' }, { t: 'shot', stats: { ...a.stats, damage: a.stats.damage / pressureOf(s) } }, ...brokeFx(slotBefore, worn, s.selected)],
      };
    }
    case 'enter': return { session: { ...s, location: a.dungeon }, fx: [{ t: 'travel', to: a.dungeon }] };
    case 'leave': return { session: { ...s, location: null }, fx: [{ t: 'travel', to: null }] };
    case 'descend': {
      const r = story({ ...s, floor: s.floor + 1, dungeons: { ...s.dungeons, depths: emptyProgress() } }, ['depth']);
      return { session: r.session, fx: [{ t: 'travel', to: 'depths' }, ...r.fx] };
    }
    case 'chest': return openChest(s, a.chest);
    case 'door': return openBossDoor(s, a.door);
    case 'talk': return talk(s, a.npc);
    case 'inspect': return inspect(s, a.spot);
    case 'dig': return dig(s, a.spot, a.stamina);
    case 'fish': return fish(s, a.stamina);
    case 'raft': return useRaft(s);
    case 'boat': return { session: s, fx: [{ t: 'voyage' }] };
    case 'place': {
      const structures = placeStructure(s.structures, a.type, a.x, a.y);
      return withStory({
        session: { ...s, structures, inventory: takeOne(s.inventory, s.selected) },
        fx: [{ t: 'built', structure: structures.list[structures.list.length - 1] }],
      }, [`build:${a.type}`]);
    }
    case 'pickup': {
      const { inv: withItem, left } = addItem(s.inventory, a.structure.type, 1);
      if (left > 0) return { session: s, fx: [say('msgFull')] };
      // A turret gives its arrows back.
      const inv = a.structure.ammo ? addItem(withItem, 'arrow', a.structure.ammo).inv : withItem;
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
    {
      const cooked = slotBefore !== null && slotBefore !== undefined && COOKED_FOODS.includes(slotBefore.item);
      const k = cooked ? sessionMods(s).food : 1;
      const food = k === 1 ? a.food : { ...a.food, hunger: Math.round(a.food.hunger * k), hp: Math.round(a.food.hp * k) };
      const meal = slotBefore ? ITEMS[slotBefore.item].food : undefined;
      let buffs = s.buffs;
      const fx: Fx[] = [{ t: 'ate' }];
      if (meal?.buff) buffs = addBuff(buffs, meal.buff.id, meal.buff.seconds, s.playTime);
      if (meal?.cure) buffs = removeBuff(buffs, meal.cure);
      // Raw food now and then makes the hero sick (cooking it, or an antidote, keeps him well).
      if (meal?.risky && new Rng(hashString(`${s.seed}:sick:${Math.floor(s.playTime * 10)}`)).chance(0.3)) {
        buffs = addBuff(buffs, 'poisoned', 25, s.playTime);
        fx.push(say('msgSick'));
      }
      return withStory(
        { session: { ...s, inventory: takeOne(s.inventory, s.selected), vitals: eat(s.vitals, food), buffs }, fx },
        cooked ? ['eat:cooked'] : [],
      );
    }
    case 'harvest': {
      const tile = idx(a.x, a.y);
      const rng = new Rng(hashString(`${s.seed}:farm:${tile}:${s.clock.day}`));
      const result = farmSim.harvest(s.farm, tile, rng);
      if (!result) return { session: s, fx: [] };
      const doubled = rng.chance(sessionMods(s).yieldFarm);
      const given = giveItems(s.inventory, doubled ? [...result.items, ...result.items] : result.items);
      if (given.overflow) return { session: s, fx: [say('msgFull')] };
      return withXp(withStory({ session: { ...s, farm: result.farm, inventory: given.inv }, fx: [{ t: 'plot', tile }, ...given.fx] }, ['harvest']), [['farming', 8]]);
    }
    case 'drink':
      return { session: { ...s, vitals: eat(s.vitals, { hunger: 0, thirst: 25, hp: 0 }) }, fx: [say('msgDrank')] };
    case 'open':
      return { session: s, fx: [{ t: 'open', structure: a.structure }] };
    case 'reload': {
      const have = a.structure.ammo ?? 0;
      if (have >= TURRET_CAPACITY) return { session: s, fx: [say('msgTurretFull')] };
      const held = countItem(s.inventory, 'arrow');
      if (held === 0) return { session: s, fx: [say('msgNoArrowsToLoad')] };
      const n = Math.min(TURRET_CAPACITY - have, held);
      const inv = removeItem(s.inventory, 'arrow', n) ?? s.inventory;
      const list = s.structures.list.map((p) => (p.id === a.structure.id ? { ...p, ammo: have + n } : p));
      return { session: { ...s, inventory: inv, structures: { ...s.structures, list } }, fx: [say('msgReloaded', { n: have + n })] };
    }
    case 'sleep': {
      const respawn = { x: pos.x, y: pos.y };
      if (!canSleep(s.clock)) return { session: { ...s, respawn }, fx: [say('msgSleepDay')] };
      return {
        session: { ...s, respawn, clock: wakeUp(s.clock), vitals: sleepRecovery(s.vitals, shelteredAt(s.structures, pos)) },
        fx: [{ t: 'slept' }, say('msgSleepNight')],
      };
    }
  }
}

/** Craft one batch at the stations in reach. Nothing changes when it is not possible. */
export function craftRecipe(s: Session, recipe: Recipe, near: ReadonlySet<Station>): Step {
  if (levelOf(s.skills.crafting) < (recipe.lvl ?? 1)) return { session: s, fx: [] };
  let inv = craft(s.inventory, recipe, near);
  if (!inv) return { session: s, fx: [] };
  // A practised hand wastes less: now and then the most plentiful ingredient comes back.
  const roll = new Rng(hashString(`${s.seed}:craft:${Math.floor(s.playTime * 10)}:${recipe.id}`));
  if (roll.chance(sessionMods(s).craftSave)) {
    const [item] = [...recipe.cost].sort((a, b) => b[1] - a[1])[0];
    inv = addItem(inv, item, 1).inv;
  }
  const cooked = recipe.station === 'campfire' && ITEMS[recipe.out].food !== undefined;
  const weight = recipe.cost.reduce((n, [, q]) => n + q, 0);
  const step = withStory({ session: { ...s, inventory: inv }, fx: [{ t: 'gain', item: recipe.out, qty: recipe.qty }] }, [`craft:${recipe.out}`, ...(cooked ? ['cook'] : [])]);
  return withXp(step, [[cooked ? 'cooking' : 'crafting', Math.min(14, 2 + Math.round(weight / 2))]]);
}

/** Take off what is worn in a gear slot. */
export function takeOffGear(s: Session, place: GearSlot): Step {
  if (!s.equipment[place]) return { session: s, fx: [] };
  const off = unequipSlot(s.inventory, s.equipment, place);
  if (!off) return { session: s, fx: [say('msgFull')] };
  return { session: { ...s, inventory: off.inv, equipment: off.equipment }, fx: [{ t: 'equipped' }] };
}

/** At an anvil: upgrade the tool in a backpack slot by one level. */
export function upgradeItem(s: Session, index: number, near: ReadonlySet<Station>): Step {
  if (!near.has('anvil')) return { session: s, fx: [] };
  const inv = upgradeSlot(s.inventory, index);
  if (!inv) return { session: s, fx: [say('msgCannotUpgrade')] };
  const slot = inv[index];
  return withXp({ session: { ...s, inventory: inv }, fx: [{ t: 'upgraded', item: slot?.item ?? 'wood', plus: slot?.plus ?? 0 }] }, [['crafting', 10 + (slot?.plus ?? 0) * 4]]);
}

/** At an anvil: put a worn tool back to full strength. */
export function repairItem(s: Session, index: number, near: ReadonlySet<Station>): Step {
  if (!near.has('anvil')) return { session: s, fx: [] };
  const inv = repairSlot(s.inventory, index);
  return inv ? { session: { ...s, inventory: inv }, fx: [say('msgRepaired')] } : { session: s, fx: [say('msgCannotUpgrade')] };
}

/** How many arrows a turret holds. */
export const TURRET_CAPACITY = 60;

/** A turret loosed an arrow: it holds one fewer. */
export function turretFired(s: Session, id: number): Session {
  const list = s.structures.list.map((p) => (p.id === id && (p.ammo ?? 0) > 0 ? { ...p, ammo: (p.ammo ?? 0) - 1 } : p));
  return { ...s, structures: { ...s.structures, list } };
}

/** Note that the night's raid has been rolled for. */
export const markRaid = (s: Session, day: number): Session => (s.raidDay === day ? s : { ...s, raidDay: day });

/** The camp held: experience and a mark for the story. */
export function raidSurvived(s: Session): Step {
  return withXp(withStory({ session: s, fx: [say('msgRaidSurvived')] }, ['raid']), [['combat', 30]]);
}

export { arrive, chooseEnding, claimOwed, dawn, reached, recordKill, story };

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
