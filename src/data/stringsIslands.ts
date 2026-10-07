import type { L10n } from '@/core/i18n';

/** Text for the far islands: sigils, island armours, the boat, dungeons and bosses (both languages; merged into UI_STRINGS). */
export const ISLAND_STRINGS: Record<string, L10n> = {
  item_boat: { en: 'Boat', id: 'Perahu' },
  item_frost_sigil: { en: 'Frost sigil', id: 'Lambang Beku' },
  item_ember_sigil: { en: 'Ember sigil', id: 'Lambang Bara' },
  item_tide_sigil: { en: 'Tide sigil', id: 'Lambang Pasang' },
  item_sky_sigil: { en: 'Sky sigil', id: 'Lambang Langit' },
  item_armor_frost: { en: 'Glacier plate', id: 'Pelat Gletser' },
  item_armor_ember: { en: 'Forgeheart plate', id: 'Pelat Jantung Tempa' },
  item_armor_tide: { en: 'Drowned plate', id: 'Pelat Tenggelam' },
  item_armor_sky: { en: 'Stormplate', id: 'Pelat Badai' },

  dungeon_frostcave: { en: 'Frostfang Cave', id: 'Gua Taring Beku' },
  dungeon_magmaforge: { en: 'Magma Forge', id: 'Tempa Magma' },
  dungeon_drownedcrypt: { en: 'Drowned Crypt', id: 'Ruang Makam Tenggelam' },
  dungeon_skyspire: { en: 'Sky Spire', id: 'Menara Langit' },
  boss_glacierking: { en: 'Glacier King', id: 'Raja Gletser' },
  boss_forgeheart: { en: 'Forgeheart', id: 'Jantung Tempa' },
  boss_drownedqueen: { en: 'Drowned Queen', id: 'Ratu Tenggelam' },
  boss_stormtitan: { en: 'Storm Titan', id: 'Titan Badai' },
};
