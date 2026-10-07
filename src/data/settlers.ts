import type { ItemId } from '@/data/items';
import type { Text } from '@/sim/quests';

export const JOBS = ['farmer', 'woodcutter', 'miner', 'cook', 'hunter'] as const;
export type Job = (typeof JOBS)[number];

export const isJob = (v: unknown): v is Job => typeof v === 'string' && (JOBS as readonly string[]).includes(v);

/** At most this many settlers share the camp. */
export const MAX_SETTLERS = 6;
/** What each store slot can hold of one thing. */
export const STORE_CAP = 300;

/** Gold to take on the next settler: the more there are, the dearer. */
export const hireCost = (alreadyHired: number): number => 150 + alreadyHired * 100;

interface Output {
  item: ItemId;
  min: number;
  max: number;
  /** Chance per day (1 when absent). */
  chance?: number;
}

export interface JobDef {
  id: Job;
  name: Text;
  about: Text;
  /** What one settler brings in each day. */
  output: readonly Output[];
}

const L = (en: string, id: string): Text => ({ en, id });

export const JOB_DEFS: Record<Job, JobDef> = {
  farmer: {
    id: 'farmer', name: L('Farmer', 'Petani'), about: L('Grows vegetables and seeds.', 'Menanam sayur dan benih.'),
    output: [{ item: 'carrot', min: 1, max: 3 }, { item: 'turnip', min: 1, max: 2 }, { item: 'pumpkin', min: 0, max: 1, chance: 0.5 }, { item: 'corn', min: 0, max: 2, chance: 0.5 }],
  },
  woodcutter: {
    id: 'woodcutter', name: L('Woodcutter', 'Penebang'), about: L('Fells trees for wood and fiber.', 'Menebang pohon untuk kayu dan serat.'),
    output: [{ item: 'wood', min: 5, max: 10 }, { item: 'fiber', min: 1, max: 4 }, { item: 'plank', min: 0, max: 2, chance: 0.4 }],
  },
  miner: {
    id: 'miner', name: L('Miner', 'Penambang'), about: L('Digs stone, ore and coal.', 'Menggali batu, bijih dan batu bara.'),
    output: [{ item: 'stone', min: 4, max: 8 }, { item: 'iron_ore', min: 0, max: 2, chance: 0.6 }, { item: 'coal', min: 0, max: 2, chance: 0.5 }, { item: 'crystal', min: 1, max: 1, chance: 0.1 }],
  },
  cook: {
    id: 'cook', name: L('Cook', 'Juru masak'), about: L('Prepares hearty meals.', 'Menyiapkan hidangan mengenyangkan.'),
    output: [{ item: 'cooked_meat', min: 1, max: 3 }, { item: 'veggie_stew', min: 0, max: 1, chance: 0.5 }, { item: 'honey', min: 0, max: 1, chance: 0.3 }],
  },
  hunter: {
    id: 'hunter', name: L('Hunter', 'Pemburu'), about: L('Brings hides, bones and meat.', 'Membawa kulit, tulang dan daging.'),
    output: [{ item: 'raw_meat', min: 1, max: 3 }, { item: 'hide', min: 0, max: 2, chance: 0.6 }, { item: 'bone', min: 0, max: 2, chance: 0.6 }, { item: 'gold', min: 3, max: 12, chance: 0.5 }],
  },
};
