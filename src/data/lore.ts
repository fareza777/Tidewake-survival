import type { ItemId } from '@/data/items';
import type { Text } from '@/sim/quests';

const L = (en: string, id: string): Text => ({ en, id });

/** Four tablets near the Sunken Ruin. */
export const TABLETS: readonly Text[] = [
  L('"The keeper lit the lamp every dusk, so no ship would strike the rocks."', '"Penjaga menyalakan lampu setiap senja, agar tak ada kapal menabrak karang."'),
  L('"Then a ship came that wanted the rocks. The lamp was turned to lure, not to warn."', '"Lalu datang kapal yang menginginkan karang. Lampu diputar untuk memikat, bukan memperingatkan."'),
  L('"Ship after ship broke on the shore. The keeper watched, and grew hollow."', '"Kapal demi kapal pecah di pantai. Penjaga menyaksikan, dan menjadi hampa."'),
  L('"Whoever takes the beacon core ends the lure. Whoever keeps it, rules the island."', '"Siapa mengambil inti mercusuar menghentikan umpannya. Siapa menyimpannya, memerintah pulau."'),
];

/** Five messages in bottles. */
export const BOTTLES: readonly Text[] = [
  L('"Day 12. The storm took the mast. We see a light on the cape. Thank the stars."', '"Hari 12. Badai merenggut tiang. Kami melihat cahaya di tanjung. Syukurlah."'),
  L('"The light moved. It was not a lighthouse. Do not follow the light."', '"Cahaya itu bergerak. Itu bukan mercusuar. Jangan ikuti cahaya itu."'),
  L('"Marlo says the old keeper was kind. Marlo says many things."', '"Marlo bilang penjaga lama itu baik. Marlo bilang banyak hal."'),
  L('"We buried the captain by the grotto. The mushrooms grow strangely there."', '"Kami mengubur kapten dekat gua. Jamur-jamur tumbuh aneh di sana."'),
  L('"If you read this, the island has taken you too. Be kind to it. It is lonely."', '"Kalau kau membaca ini, pulau ini juga telah mengambilmu. Berbaiklah padanya. Ia kesepian."'),
];

/** What each of the three buried chests holds. */
export const TREASURE_LOOT: Readonly<Record<number, readonly { item: ItemId; qty: number }[]>> = {
  1: [{ item: 'iron_ingot', qty: 3 }, { item: 'arrow', qty: 8 }],
  2: [{ item: 'honey', qty: 3 }, { item: 'bandage', qty: 3 }],
  3: [{ item: 'crystal', qty: 2 }, { item: 'rope', qty: 4 }],
};

export const CAT_FOUND: Text = L('Mittens blinks at you and trots toward Tali\'s camp.', 'Mittens berkedip padamu dan berlari kecil menuju kemah Tali.');

/** What the hero learns when the Hollow Keeper falls. */
export const LIGHTHOUSE_SECRET: readonly Text[] = [
  L('The Hollow Keeper crumbles. Behind the beacon, a window shows the sea below.', 'Hollow Keeper runtuh. Di balik mercusuar, sebuah jendela menampakkan laut di bawah.'),
  L('The rocks around the cape are crowded with wrecks: hundreds of ships, a graveyard the lamp built.', 'Karang di sekitar tanjung penuh bangkai kapal: ratusan, kuburan yang dibangun lampu itu.'),
  L('The beacon core is warm in your hands. The island is yours to leave, or to keep.', 'Inti mercusuar hangat di tanganmu. Pulau ini bisa kau tinggalkan, atau kau jaga.'),
];

export const ENDING_A: readonly Text[] = [
  L('You push the raft into the surf. The sail fills, and the island shrinks behind you.', 'Kau mendorong rakit ke ombak. Layar mengembang, dan pulau mengecil di belakangmu.'),
  L('You carry the beacon core home as proof, and a story nobody believes.', 'Kau membawa inti mercusuar pulang sebagai bukti, dan cerita yang tak dipercaya siapa pun.'),
  L('Ending A: Set Sail. Thank you for playing Tidewake.', 'Akhir A: Berlayar. Terima kasih sudah bermain Tidewake.'),
];

export const ENDING_B: readonly Text[] = [
  L('You carry the beacon core up the tower and set it back in the lamp. A true light shines out over the water.', 'Kau membawa inti mercusuar ke menara dan memasangnya kembali di lampu. Cahaya yang jujur menyinari air.'),
  L('Ships turn from the rocks. In time, they come to the harbor you build.', 'Kapal-kapal menjauh dari karang. Lama-lama, mereka datang ke pelabuhan yang kau bangun.'),
  L('Ending B: The Keeper. Thank you for playing Tidewake.', 'Akhir B: Sang Penjaga. Terima kasih sudah bermain Tidewake.'),
];
