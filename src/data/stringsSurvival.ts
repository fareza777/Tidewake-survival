import type { L10n } from '@/core/i18n';

/** Text for seasons, weather, warmth, lasting effects, building and raids (both languages; merged into UI_STRINGS). */
export const SURVIVAL_STRINGS: Record<string, L10n> = {
  // Seasons and weather
  season_spring: { en: 'Spring', id: 'Semi' },
  season_summer: { en: 'Summer', id: 'Panas' },
  season_autumn: { en: 'Autumn', id: 'Gugur' },
  season_winter: { en: 'Winter', id: 'Dingin' },
  weather_clear: { en: 'Clear', id: 'Cerah' },
  weather_cloudy: { en: 'Cloudy', id: 'Berawan' },
  weather_rain: { en: 'Rain', id: 'Hujan' },
  weather_storm: { en: 'Storm', id: 'Badai' },
  weather_blizzard: { en: 'Blizzard', id: 'Badai salju' },
  weather_fog: { en: 'Fog', id: 'Kabut' },
  weather_snow: { en: 'Snow', id: 'Salju' },
  hudSeason: { en: '{season}, day {n}', id: '{season}, hari {n}' },
  msgSeasonChange: { en: 'The season has turned to {season}.', id: 'Musim berganti menjadi {season}.' },
  msgWinterFields: { en: 'Nothing grows in the winter cold.', id: 'Tidak ada yang tumbuh di musim dingin.' },
  msgRainFields: { en: 'The rain has watered your fields.', id: 'Hujan telah menyirami ladangmu.' },

  // Warmth
  msgFreezing: { en: 'You are freezing! Find a fire or put on something warm.', id: 'Kamu kedinginan! Cari api atau pakai yang hangat.' },
  msgShivering: { en: 'You are getting cold.', id: 'Kamu mulai kedinginan.' },

  // Lasting effects
  buff_wellfed: { en: 'Well fed', id: 'Kenyang' },
  buff_energized: { en: 'Energized', id: 'Bertenaga' },
  buff_warm: { en: 'Warm', id: 'Hangat' },
  buff_strong: { en: 'Strong', id: 'Kuat' },
  buff_swift: { en: 'Swift', id: 'Gesit' },
  buff_fortified: { en: 'Fortified', id: 'Terlindungi' },
  buff_poisoned: { en: 'Poisoned', id: 'Keracunan' },
  msgSick: { en: 'The raw food made you sick!', id: 'Makanan mentah itu membuatmu sakit!' },

  // Building
  msgReloaded: { en: 'The turret holds {n} arrows now.', id: 'Menara kini berisi {n} anak panah.' },
  msgNoArrowsToLoad: { en: 'You have no arrows to load.', id: 'Kamu tidak punya anak panah.' },
  msgTurretFull: { en: 'The turret is full.', id: 'Menara sudah penuh.' },
  turretArrows: { en: 'Arrows {n}', id: 'Panah {n}' },

  // Raids
  msgRaid: { en: 'Monsters are gathering around your camp!', id: 'Monster berkumpul di sekitar perkemahanmu!' },
  msgRaidSurvived: { en: 'You held the camp. The raid is over.', id: 'Perkemahan bertahan. Serangan berakhir.' },

  // Items
  item_wood_wall: { en: 'Wooden wall', id: 'Dinding kayu' },
  item_stone_wall: { en: 'Stone wall', id: 'Dinding batu' },
  item_wood_door: { en: 'Wooden gate', id: 'Gerbang kayu' },
  item_wood_floor: { en: 'Wooden floor', id: 'Lantai kayu' },
  item_tent: { en: 'Tent', id: 'Tenda' },
  item_turret: { en: 'Crossbow turret', id: 'Menara panah' },
  item_warm_stew: { en: 'Hearty stew', id: 'Sup hangat' },
  item_potion_strength: { en: 'Strength potion', id: 'Ramuan kekuatan' },
  item_potion_swift: { en: 'Swiftness potion', id: 'Ramuan kecepatan' },
  item_potion_ward: { en: 'Warding potion', id: 'Ramuan perlindungan' },
  item_potion_warmth: { en: 'Warming potion', id: 'Ramuan penghangat' },
};
