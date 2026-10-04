import { CROPS, type CropId } from '@/data/crops';
import { ITEMS, isItemId } from '@/data/items';
import { CHEST_SLOTS, STRUCTURES, type StructureId } from '@/data/structures';
import { DAY_SECONDS, type Clock } from '@/sim/daynight';
import { DUNGEON_VERSION, emptyDungeons, isDungeonId, parseDungeons, type DungeonId, type Dungeons } from '@/sim/dungeon/progress';
import { noEquipment, parseEquipment, type Equipment } from '@/sim/equipment';
import { emptyFarm, type Farm, type Plot } from '@/sim/farm';
import { emptyGather, type GatherState } from '@/sim/gather';
import { HOTBAR_SIZE, INVENTORY_SIZE, addItem, emptyInventory, type Inventory, type Slot } from '@/sim/inventory';
import type { Structure, Structures } from '@/sim/structures';
import { VITAL_MAX, fullVitals, type Difficulty, type Vitals } from '@/sim/vitals';
import { GENERATOR_VERSION } from '@/sim/world/generate';
import { WORLD_SIZE } from '@/sim/world/types';

export const SAVE_VERSION = 3;
/** A save claiming more days than this is corrupt (real games last far fewer). */
const MAX_DAY = 1_000_000;

export type { Difficulty };
const DIFFICULTIES: readonly Difficulty[] = ['relaxed', 'normal', 'hardcore'];

/** Everything that survives closing the app. The island itself is regenerated from `seed`. */
export interface SaveSlot {
  version: number;
  slot: number;
  name: string;
  seed: number;
  /** GENERATOR_VERSION the island was played on; if it changed, harvested-node state no longer applies. */
  worldVersion: number;
  difficulty: Difficulty;
  createdAt: number;
  updatedAt: number;
  playTimeSec: number;
  player: { x: number; y: number };
  /** Where the hero wakes up after sleeping or collapsing. */
  respawn: { x: number; y: number };
  clock: Clock;
  gather: GatherState;
  inventory: Inventory;
  /** Selected hotbar slot. */
  selected: number;
  vitals: Vitals;
  structures: Structures;
  farm: Farm;
  /** The dungeon the hero is in, or null on the island. `player` is in that dungeon's coordinates. */
  location: DungeonId | null;
  equipment: Equipment;
  dungeons: Dungeons;
  /** DUNGEON_VERSION the dungeon progress was made under. */
  dungeonVersion: number;
}

export interface SlotSummary {
  slot: number;
  name: string;
  day: number;
  playTimeSec: number;
  updatedAt: number;
  seed: number;
  difficulty: Difficulty;
}

export function newSlot(
  slot: number, name: string, seed: number, difficulty: Difficulty, start: { x: number; y: number }, clock: Clock, now = Date.now(),
): SaveSlot {
  const spawn = { x: start.x + 0.5, y: start.y + 0.5 };
  return {
    version: SAVE_VERSION, slot, name, seed, worldVersion: GENERATOR_VERSION, difficulty, createdAt: now, updatedAt: now,
    playTimeSec: 0, player: spawn, respawn: { ...spawn }, clock, gather: emptyGather(), inventory: emptyInventory(), selected: 0,
    vitals: fullVitals(), structures: { next: 1, list: [] }, farm: emptyFarm(), location: null, equipment: noEquipment(),
    dungeons: emptyDungeons(), dungeonVersion: DUNGEON_VERSION,
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isRecordOfNumbers = (v: unknown): v is Record<string, number> => isRecord(v) && Object.values(v).every((n) => isNum(n) && n >= 0);
const clampVital = (v: unknown, fallback: number): number => (isNum(v) ? Math.min(VITAL_MAX, Math.max(0, v)) : fallback);

/** Keep every valid slot of an untrusted inventory and drop the rest (unknown items, bad counts, broken tools). */
function parseInventory(raw: unknown, size: number): Inventory {
  const out: (Slot | null)[] = [...emptyInventory(size)];
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < Math.min(size, raw.length); i++) {
    const s: unknown = raw[i];
    if (!isRecord(s) || !isItemId(s.item) || !isInt(s.qty) || s.qty < 1) continue;
    const def = ITEMS[s.item];
    if (!def.tool) {
      out[i] = { item: s.item, qty: Math.min(def.stack, s.qty) };
      continue;
    }
    const dur = isNum(s.dur) ? Math.min(def.tool.durability, Math.max(0, s.dur)) : def.tool.type === 'can' ? 0 : def.tool.durability;
    if (dur <= 0 && def.tool.type !== 'can') continue;
    out[i] = { item: s.item, qty: 1, dur };
  }
  return out;
}

function parseVitals(raw: unknown): Vitals {
  const d = isRecord(raw) ? raw : {};
  return { hp: clampVital(d.hp, VITAL_MAX), hunger: clampVital(d.hunger, VITAL_MAX), thirst: clampVital(d.thirst, VITAL_MAX), stamina: clampVital(d.stamina, VITAL_MAX) };
}

function parseStructures(raw: unknown): Structures {
  const list: Structure[] = [];
  const d = isRecord(raw) ? raw : {};
  const seenTiles = new Set<number>();
  const seenIds = new Set<number>();
  for (const e of Array.isArray(d.list) ? (d.list as unknown[]) : []) {
    if (!isRecord(e) || typeof e.type !== 'string' || !Object.prototype.hasOwnProperty.call(STRUCTURES, e.type)) continue;
    if (!isInt(e.id) || e.id < 1 || !isInt(e.x) || !isInt(e.y)) continue;
    if (e.x < 0 || e.y < 0 || e.x >= WORLD_SIZE || e.y >= WORLD_SIZE) continue;
    const tile = e.y * WORLD_SIZE + e.x;
    if (seenTiles.has(tile) || seenIds.has(e.id)) continue;
    seenTiles.add(tile);
    seenIds.add(e.id);
    const type = e.type as StructureId;
    list.push(type === 'chest' ? { id: e.id, type, x: e.x, y: e.y, inv: parseInventory(e.inv, CHEST_SLOTS) } : { id: e.id, type, x: e.x, y: e.y });
  }
  const next = Math.max(isInt(d.next) ? d.next : 1, ...list.map((s) => s.id + 1), 1);
  return { next, list };
}

function parseFarm(raw: unknown): Farm {
  const plots: Record<number, Plot> = {};
  const d = isRecord(raw) && isRecord(raw.plots) ? raw.plots : {};
  for (const [key, p] of Object.entries(d)) {
    const tile = Number(key);
    if (!Number.isInteger(tile) || tile < 0 || tile >= WORLD_SIZE * WORLD_SIZE || !isRecord(p)) continue;
    const crop = typeof p.crop === 'string' && Object.prototype.hasOwnProperty.call(CROPS, p.crop) ? (p.crop as CropId) : null;
    const growth = crop && isInt(p.growth) ? Math.min(CROPS[crop].growDays, Math.max(0, p.growth)) : 0;
    plots[tile] = { crop, growth, watered: p.watered === true };
  }
  return { plots };
}

/** Phase 1 saves kept loose materials in a `bag`; they become ordinary inventory items. */
function inventoryFromBag(bag: unknown): Inventory {
  let inv = emptyInventory();
  if (!isRecord(bag)) return inv;
  for (const [item, n] of Object.entries(bag)) {
    if (isItemId(item) && isInt(n) && n > 0) inv = addItem(inv, item, n).inv;
  }
  return inv;
}

/** Validate untrusted JSON into a SaveSlot; null when it cannot be trusted (corrupt, or from a newer game version). */
export function parseSlot(raw: unknown, slot: number): SaveSlot | null {
  if (!isRecord(raw)) return null;
  const d = raw;
  if (d.version !== 1 && d.version !== 2 && d.version !== 3) return null;
  if (!isNum(d.seed)) return null;
  const player = d.player;
  const clock = d.clock;
  if (!isRecord(player) || !isNum(player.x) || !isNum(player.y)) return null;
  if (!isRecord(clock) || !isNum(clock.day) || clock.day < 1 || clock.day > MAX_DAY) return null;
  // The time of day is always inside one day; a huge value would make the clock loop for ages.
  if (!isNum(clock.t) || clock.t < 0 || clock.t >= DAY_SECONDS) return null;
  const gather = isRecord(d.gather) ? d.gather : undefined;
  const hp = gather?.hp ?? {};
  const gone = gather?.gone ?? {};
  if (!isRecordOfNumbers(hp) || !isRecordOfNumbers(gone)) return null;
  const respawn = isRecord(d.respawn) && isNum(d.respawn.x) && isNum(d.respawn.y) ? { x: d.respawn.x, y: d.respawn.y } : { x: player.x, y: player.y };
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    slot,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 16) : 'Castaway',
    seed: d.seed >>> 0,
    worldVersion: isInt(d.worldVersion) ? d.worldVersion : 1,
    difficulty: DIFFICULTIES.includes(d.difficulty as Difficulty) ? (d.difficulty as Difficulty) : 'normal',
    createdAt: isNum(d.createdAt) ? d.createdAt : now,
    updatedAt: isNum(d.updatedAt) ? d.updatedAt : now,
    playTimeSec: isNum(d.playTimeSec) && d.playTimeSec >= 0 ? d.playTimeSec : 0,
    player: { x: player.x, y: player.y },
    respawn,
    clock: { day: Math.floor(clock.day), t: clock.t },
    gather: { hp, gone },
    inventory: d.version === 1 ? inventoryFromBag(d.bag) : parseInventory(d.inventory, INVENTORY_SIZE),
    selected: isInt(d.selected) && d.selected >= 0 && d.selected < HOTBAR_SIZE ? d.selected : 0,
    vitals: parseVitals(d.vitals),
    structures: parseStructures(d.structures),
    farm: parseFarm(d.farm),
    location: isDungeonId(d.location) ? d.location : null,
    equipment: parseEquipment(d.equipment),
    dungeons: parseDungeons(d.dungeons),
    dungeonVersion: isInt(d.dungeonVersion) ? d.dungeonVersion : DUNGEON_VERSION,
  };
}
