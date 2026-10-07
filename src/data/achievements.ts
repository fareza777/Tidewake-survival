import { CREATURE_IDS } from '@/data/creatures';
import type { Text } from '@/sim/quests';
import { MAX_LEVEL, SKILLS, levelOf } from '@/sim/skills';
import type { Session } from '@/sim/session';
import { countItem } from '@/sim/inventory';

const L = (en: string, id: string): Text => ({ en, id });
const count = (s: Session, key: string): number => s.quests.counters[key] ?? 0;
const sumOf = (s: Session, prefix: string): number =>
  Object.entries(s.quests.counters).reduce((n, [k, v]) => (k.startsWith(prefix) ? n + v : n), 0);
const BOSSES = ['mossback', 'ironbones', 'mirelord', 'hollowkeeper', 'glacierking', 'forgeheart', 'drownedqueen', 'stormtitan'] as const;
const ISLANDS = ['frost', 'ember', 'wreck', 'sky'] as const;

export interface Achievement {
  id: string;
  title: Text;
  about: Text;
  /** Gold paid when it is earned. */
  reward: number;
  check: (s: Session) => boolean;
  /** How far along it is, as `[have, need]`, when that can be counted. */
  progress?: (s: Session) => readonly [number, number];
}

const counting = (title: Text, about: Text, reward: number, need: number, have: (s: Session) => number): Achievement => ({
  id: '', title, about, reward, check: (s) => have(s) >= need, progress: (s) => [Math.min(have(s), need), need],
});

const A = (id: string, a: Achievement): Achievement => ({ ...a, id });

export const ACHIEVEMENTS: readonly Achievement[] = [
  A('first_blood', counting(L('First Blood', 'Darah Pertama'), L('Defeat a creature', 'Kalahkan satu makhluk'), 10, 1, (s) => sumOf(s, 'kill:'))),
  A('slayer', counting(L('Slayer', 'Pemburu'), L('Defeat 100 creatures', 'Kalahkan 100 makhluk'), 100, 100, (s) => sumOf(s, 'kill:'))),
  A('exterminator', counting(L('Exterminator', 'Pembasmi'), L('Defeat 500 creatures', 'Kalahkan 500 makhluk'), 400, 500, (s) => sumOf(s, 'kill:'))),
  A('boss_one', counting(L('Giant Slayer', 'Pembunuh Raksasa'), L('Defeat a boss', 'Kalahkan satu bos'), 30, 1, (s) => BOSSES.filter((b) => count(s, `boss:${b}`) > 0).length)),
  A('boss_all', counting(L('Bossbreaker', 'Penakluk Bos'), L('Defeat all eight bosses', 'Kalahkan kedelapan bos'), 800, BOSSES.length, (s) => BOSSES.filter((b) => count(s, `boss:${b}`) > 0).length)),
  A('survivor', counting(L('Survivor', 'Penyintas'), L('Survive 10 nights', 'Bertahan 10 malam'), 40, 10, (s) => count(s, 'night'))),
  A('old_salt', counting(L('Old Salt', 'Pelaut Tua'), L('Survive 50 nights', 'Bertahan 50 malam'), 250, 50, (s) => count(s, 'night'))),
  A('explorer', counting(L('Beyond the Reef', 'Di Balik Karang'), L('Set foot on every far island', 'Injak setiap pulau jauh'), 200, ISLANDS.length, (s) => ISLANDS.filter((i) => count(s, `island:${i}`) > 0).length)),
  A('builder', counting(L('Builder', 'Pembangun'), L('Build 30 things', 'Bangun 30 benda'), 60, 30, (s) => sumOf(s, 'build:'))),
  A('harvester', counting(L('Green Thumb', 'Tangan Hijau'), L('Harvest 50 crops', 'Panen 50 tanaman'), 60, 50, (s) => count(s, 'harvest'))),
  A('cook', counting(L('Chef', 'Koki'), L('Cook 25 dishes', 'Masak 25 hidangan'), 60, 25, (s) => count(s, 'cook'))),
  A('angler', counting(L('Big Fish', 'Ikan Besar'), L('Catch a rare fish', 'Tangkap ikan langka'), 30, 1, (s) => count(s, 'fish:big'))),
  A('trader', counting(L('Trader', 'Pedagang'), L('Sell 20 goods', 'Jual 20 barang'), 40, 20, (s) => count(s, 'sell'))),
  A('shopper', counting(L('Big Spender', 'Si Boros'), L('Buy 10 goods', 'Beli 10 barang'), 40, 10, (s) => sumOf(s, 'buy:'))),
  A('rich', counting(L('Pockets of Gold', 'Kantong Emas'), L('Carry 1000 gold', 'Bawa 1000 emas'), 100, 1000, (s) => countItem(s.inventory, 'gold'))),
  A('tempered', counting(L('Tempered', 'Tertempa'), L('Upgrade a tool to +5', 'Tingkatkan alat ke +5'), 120, 5, (s) => Math.max(0, ...s.inventory.map((x) => x?.plus ?? 0)))),
  A('journeyman', counting(L('Journeyman', 'Ahli Muda'), L('Reach level 5 in any skill', 'Capai level 5 di satu skill'), 40, 5, (s) => Math.max(...SKILLS.map((k) => levelOf(s.skills[k]))))),
  A('master', counting(L('Master', 'Master'), L('Reach the top level in any skill', 'Capai level tertinggi di satu skill'), 150, MAX_LEVEL, (s) => Math.max(...SKILLS.map((k) => levelOf(s.skills[k]))))),
  A('polymath', counting(L('Polymath', 'Serba Bisa'), L('Reach level 8 in every skill', 'Capai level 8 di semua skill'), 400, 8, (s) => Math.min(...SKILLS.map((k) => levelOf(s.skills[k]))))),
  A('lighthouse', counting(L('Keeper of the Light', 'Penjaga Cahaya'), L('Finish the lighthouse chapter', 'Selesaikan bab mercusuar'), 100, 1, (s) => (s.quests.done.includes('c9') ? 1 : 0))),
  A('legend', counting(L('Keeper of the Archipelago', 'Penjaga Kepulauan'), L('Finish the story of the four sigils', 'Selesaikan kisah empat lambang'), 600, 1, (s) => (s.quests.done.includes('c16') ? 1 : 0))),
  A('bestiary', counting(L('Naturalist', 'Naturalis'), L('Defeat every kind of creature', 'Kalahkan setiap jenis makhluk'), 300, CREATURE_IDS.length, (s) => CREATURE_IDS.filter((c) => count(s, `kill:${c}`) > 0).length)),
];

/** The achievements `s` has earned and not yet been paid for. */
export function newAchievements(s: Session): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !s.quests.counters[`ach:${a.id}`] && a.check(s));
}

export const isEarned = (s: Session, a: Achievement): boolean => (s.quests.counters[`ach:${a.id}`] ?? 0) > 0;
