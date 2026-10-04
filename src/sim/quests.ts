import type { L10n } from '@/core/i18n';
import { isItemId, type ItemId } from '@/data/items';
import { countItem, type Inventory } from '@/sim/inventory';

/** What a step asks for: something that happened (a named counter) or something in the backpack. */
export type Objective = { counter: string; n: number } | { have: ItemId; n: number };

/** A line of story text: both languages inline (plain strings are used by tests). */
export type Text = L10n | string;

export interface QuestStep {
  /** The line shown in the log and on the tracker. */
  text: Text;
  obj: Objective;
  /** Count only what happens after this step began (kills, digs, a second talk); otherwise everything counts. */
  fresh?: boolean;
}

export interface Reward {
  item: ItemId;
  qty: number;
}

export interface QuestDef {
  id: string;
  kind: 'main' | 'side';
  title: Text;
  /** The NPC who gives a side quest (it begins when they say so, never by itself). */
  giver?: string;
  /** Quest that must be done first. */
  after?: string;
  /** Begins as soon as `after` is done (the main chapters). */
  auto?: boolean;
  steps: readonly QuestStep[];
  reward?: readonly Reward[];
}

export type QuestDefs = Readonly<Record<string, QuestDef>>;

/** Where one active quest stands. `base` holds the counters as they were when the step began (for fresh steps). */
export interface QuestRun {
  readonly step: number;
  readonly base: Readonly<Record<string, number>>;
}

export interface QuestState {
  readonly active: Readonly<Record<string, QuestRun>>;
  readonly done: readonly string[];
  /** Everything that has happened, by name: `craft:axe_wood`, `kill:boar`, `talk:marlo`, `night`, `dig`... */
  readonly counters: Readonly<Record<string, number>>;
  /** Places in the world already used up: bottles picked up, tablets read, treasure dug. */
  readonly found: readonly string[];
  /** How the story ended, once it has. */
  readonly ending: 'A' | 'B' | null;
  /** Rewards of finished quests that did not fit the backpack yet. */
  readonly owed: readonly Reward[];
}

export type QuestEvent =
  | { t: 'started'; id: string }
  | { t: 'step'; id: string; step: number }
  | { t: 'done'; id: string; reward: readonly Reward[] };

export const emptyQuests = (): QuestState => ({ active: {}, done: [], counters: {}, found: [], ending: null, owed: [] });

/** A counter raised by `n`. */
export function bump(q: QuestState, key: string, n = 1): QuestState {
  return { ...q, counters: { ...q.counters, [key]: (q.counters[key] ?? 0) + n } };
}

const entering = (q: QuestState, def: QuestDef, step: number): QuestRun => {
  const obj = def.steps[step].obj;
  return { step, base: 'counter' in obj ? { [obj.counter]: q.counters[obj.counter] ?? 0 } : {} };
};

const unlocked = (q: QuestState, def: QuestDef): boolean => !def.after || q.done.includes(def.after);

/** Begin a quest. Nothing changes when it is unknown, already running or done, or not yet unlocked. */
export function startQuest(q: QuestState, defs: QuestDefs, id: string): QuestState {
  const def = defs[id];
  if (!def || id in q.active || q.done.includes(id) || !unlocked(q, def)) return q;
  return { ...q, active: { ...q.active, [id]: entering(q, def, 0) } };
}

/** How far the current step of a quest is: what the hero has against what is asked. */
export function progressOf(q: QuestState, defs: QuestDefs, id: string, inv: Inventory): { have: number; need: number } {
  const run = q.active[id];
  const step = run ? defs[id]?.steps[run.step] : undefined;
  if (!run || !step) return { have: 0, need: 0 };
  if ('have' in step.obj) return { have: Math.min(step.obj.n, countItem(inv, step.obj.have)), need: step.obj.n };
  const total = q.counters[step.obj.counter] ?? 0;
  const have = step.fresh ? total - (run.base[step.obj.counter] ?? 0) : total;
  return { have: Math.min(step.obj.n, Math.max(0, have)), need: step.obj.n };
}

const MAX_PASSES = 64;

/**
 * Move every quest along as far as what has happened and what the hero carries allows: auto-start chapters whose turn it
 * is, pass finished steps, finish quests. Events come back in the order they happened.
 */
export function settle(q: QuestState, inv: Inventory, defs: QuestDefs): { q: QuestState; events: QuestEvent[] } {
  let cur = q;
  const events: QuestEvent[] = [];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (const def of Object.values(defs)) {
      if (def.auto && !(def.id in cur.active) && !cur.done.includes(def.id) && unlocked(cur, def)) {
        cur = startQuest(cur, defs, def.id);
        events.push({ t: 'started', id: def.id });
        changed = true;
      }
    }
    for (const id of Object.keys(cur.active)) {
      const def = defs[id];
      const run = cur.active[id];
      const p = progressOf(cur, defs, id, inv);
      if (p.need === 0 || p.have < p.need) continue;
      changed = true;
      const rest = Object.fromEntries(Object.entries(cur.active).filter(([k]) => k !== id));
      if (run.step + 1 >= def.steps.length) {
        cur = { ...cur, active: rest, done: [...cur.done, id] };
        events.push({ t: 'done', id, reward: def.reward ?? [] });
      } else {
        cur = { ...cur, active: { ...rest, [id]: entering(cur, def, run.step + 1) } };
        events.push({ t: 'step', id, step: run.step + 1 });
      }
    }
    if (!changed) break;
  }
  return { q: cur, events };
}

/** The quest the tracker shows: the running main chapter, else a running side quest, else nothing. */
export function trackedQuest(q: QuestState, defs: QuestDefs): QuestDef | null {
  const ids = Object.keys(q.active).filter((id) => defs[id]);
  const id = ids.find((k) => defs[k].kind === 'main') ?? ids[0];
  return id ? defs[id] : null;
}

// ---- reading a save

const MAX_ENTRIES = 120;
const KEY = /^[a-z0-9:_]{1,40}$/;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1_000_000;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseCounters(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_ENTRIES) break;
    if (KEY.test(k) && isCount(v)) out[k] = v;
  }
  return out;
}

function parseStrings(raw: unknown, ok: (s: string) => boolean): string[] {
  const out: string[] = [];
  if (!Array.isArray(raw)) return out;
  for (const v of raw as unknown[]) {
    if (out.length >= MAX_ENTRIES) break;
    if (typeof v === 'string' && ok(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

function parseOwed(raw: unknown): Reward[] {
  const out: Reward[] = [];
  if (!Array.isArray(raw)) return out;
  for (const r of raw as unknown[]) {
    if (out.length >= 20) break;
    if (isRecord(r) && isItemId(r.item) && typeof r.qty === 'number' && Number.isInteger(r.qty) && r.qty >= 1 && r.qty <= 99) out.push({ item: r.item, qty: r.qty });
  }
  return out;
}

/** Validate untrusted JSON into quest progress; anything unreadable is dropped. */
export function parseQuests(raw: unknown, defs: QuestDefs): QuestState {
  if (!isRecord(raw)) return emptyQuests();
  const done = parseStrings(raw.done, (id) => id in defs);
  const active: Record<string, QuestRun> = {};
  if (isRecord(raw.active)) {
    for (const [id, r] of Object.entries(raw.active)) {
      const def = defs[id];
      if (!def || done.includes(id) || !isRecord(r) || !isCount(r.step) || r.step >= def.steps.length) continue;
      active[id] = { step: r.step, base: parseCounters(r.base) };
    }
  }
  return {
    active, done, counters: parseCounters(raw.counters), found: parseStrings(raw.found, (s) => KEY.test(s)),
    ending: raw.ending === 'A' || raw.ending === 'B' ? raw.ending : null, owed: parseOwed(raw.owed),
  };
}
