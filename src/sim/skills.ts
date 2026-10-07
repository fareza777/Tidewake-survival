/** Six skills that grow by use. Levels run from 1 to MAX_LEVEL; each level of a skill is a small, permanent bonus. */
export const SKILLS = ['woodcutting', 'mining', 'combat', 'farming', 'cooking', 'crafting'] as const;
export type SkillId = (typeof SKILLS)[number];

export const MAX_LEVEL = 10;

/** Experience points per skill (the level is worked out from them). */
export type Skills = Readonly<Record<SkillId, number>>;

export const noSkills = (): Skills => ({ woodcutting: 0, mining: 0, combat: 0, farming: 0, cooking: 0, crafting: 0 });

/** XP needed to climb from `level` to the next one. */
const step = (level: number): number => Math.round(75 * Math.pow(level, 1.9));

/** Total XP a skill must have to be at `level`. */
export function xpToReach(level: number): number {
  let total = 0;
  for (let n = 1; n < Math.min(level, MAX_LEVEL); n++) total += step(n);
  return total;
}

export function levelOf(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level += 1;
  return level;
}

export interface SkillProgress {
  level: number;
  /** XP earned inside this level, and what the whole level takes (0 at the top level). */
  into: number;
  need: number;
}

export function progressOf(xp: number): SkillProgress {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0 };
  return { level, into: xp - xpToReach(level), need: step(level) };
}

export interface XpGain {
  skills: Skills;
  /** The new level when this gain crossed a level, else null. */
  leveledTo: number | null;
}

/** Add experience to one skill (the input is never changed). */
export function gainXp(skills: Skills, id: SkillId, amount: number): XpGain {
  if (!(amount > 0)) return { skills, leveledTo: null };
  const before = skills[id];
  const cap = xpToReach(MAX_LEVEL);
  const after = Math.min(cap, before + amount);
  if (after === before) return { skills, leveledTo: null };
  const was = levelOf(before);
  const now = levelOf(after);
  return { skills: { ...skills, [id]: after }, leveledTo: now > was ? now : null };
}

export const levelsOf = (skills: Skills): Record<SkillId, number> => {
  const out = {} as Record<SkillId, number>;
  for (const id of SKILLS) out[id] = levelOf(skills[id]);
  return out;
};

/** The sum of all skill levels, shown as the hero's overall rank. */
export function rankOf(skills: Skills): number {
  return SKILLS.reduce((n, id) => n + levelOf(skills[id]), 0) - SKILLS.length + 1;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validate untrusted JSON into skills; anything unusable is zero. */
export function parseSkills(raw: unknown): Skills {
  const out = { ...noSkills() } as Record<SkillId, number>;
  if (typeof raw !== 'object' || raw === null) return out;
  const d = raw as Record<string, unknown>;
  const cap = xpToReach(MAX_LEVEL);
  for (const id of SKILLS) out[id] = isNum(d[id]) ? Math.min(cap, Math.max(0, d[id])) : 0;
  return out;
}
