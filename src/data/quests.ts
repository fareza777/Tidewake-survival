import type { ItemId } from '@/data/items';
import type { QuestDef, QuestDefs, QuestStep, Reward, Text } from '@/sim/quests';

const L = (en: string, id: string): Text => ({ en, id });
const count = (counter: string, n: number, text: Text, fresh = false): QuestStep => ({ text, obj: { counter, n }, ...(fresh ? { fresh } : {}) });
const have = (item: ItemId, n: number, text: Text): QuestStep => ({ text, obj: { have: item, n } });
const chapter = (n: number, title: Text, steps: QuestStep[]): QuestDef => ({
  id: `c${n}`, kind: 'main', title, auto: true, ...(n > 1 ? { after: `c${n - 1}` } : {}), steps,
});
const side = (id: string, giver: string, after: string, title: Text, steps: QuestStep[], reward: Reward[]): QuestDef => ({
  id, kind: 'side', title, giver, after, steps, reward,
});

/** The ten chapters of the main quest, which follow one another by themselves. */
const MAIN: QuestDef[] = [
  chapter(1, L('Washed Ashore', 'Terdampar'), [
    have('wood', 5, L('Gather 5 wood', 'Kumpulkan 5 kayu')),
    count('craft:axe_wood', 1, L('Craft a wooden axe', 'Buat kapak kayu')),
    count('build:campfire', 1, L('Build a campfire', 'Bangun api unggun')),
  ]),
  chapter(2, L('First Night', 'Malam Pertama'), [
    count('build:bed', 1, L('Build a bed', 'Buat tempat tidur')),
    count('eat:cooked', 1, L('Eat a cooked meal', 'Makan makanan matang')),
    count('night', 1, L('Survive until dawn', 'Bertahan sampai fajar'), true),
  ]),
  chapter(3, L('The Old Sailor', 'Pelaut Tua'), [
    count('reach:sailor', 1, L("Find the old sailor's hut", 'Temukan gubuk pelaut tua')),
    count('talk:marlo', 1, L('Talk to Marlo', 'Bicara dengan Marlo')),
  ]),
  chapter(4, L('Mushroom Grotto', 'Gua Jamur'), [
    count('reach:grotto', 1, L('Find the Mushroom Grotto', 'Temukan Gua Jamur')),
    count('boss:mossback', 1, L('Defeat Mossback', 'Kalahkan Mossback')),
    have('compass', 1, L('Take the compass', 'Ambil kompasnya')),
  ]),
  chapter(5, L('Iron and Fire', 'Besi dan Api'), [
    have('iron_ore', 4, L('Mine 4 iron ore on the mountain', 'Tambang 4 bijih besi di gunung')),
    count('build:furnace', 1, L('Build a furnace', 'Bangun tungku')),
    count('craft:iron_ingot', 2, L('Smelt 2 iron ingots', 'Lebur 2 besi batang')),
    count('craft:pickaxe_iron', 1, L('Craft an iron pickaxe', 'Buat beliung besi')),
  ]),
  chapter(6, L('Deepmine', 'Tambang Dalam'), [
    count('reach:deepmine', 1, L('Find the Deepmine', 'Temukan Tambang Dalam')),
    count('boss:ironbones', 1, L('Defeat Ironbones', 'Kalahkan Ironbones')),
    have('hull_planks', 1, L('Take the hull planks', 'Ambil papan lambung')),
  ]),
  chapter(7, L('Swamp Fever', 'Demam Rawa'), [
    count('reach:herbalist', 1, L('Reach the herbalist in the swamp', 'Capai tabib di rawa')),
    count('talk:nia', 1, L('Talk to Nia', 'Bicara dengan Nia')),
    count('craft:antidote', 1, L('Craft an antidote at a campfire', 'Buat penawar di api unggun')),
    count('talk:nia', 1, L('Bring the antidote to Nia', 'Bawa penawar ke Nia'), true),
  ]),
  chapter(8, L('Sunken Ruin', 'Reruntuhan Tenggelam'), [
    count('reach:ruin', 1, L('Find the Sunken Ruin in the desert', 'Temukan Reruntuhan Tenggelam di gurun')),
    count('boss:mirelord', 1, L('Defeat Mirelord', 'Kalahkan Mirelord')),
    have('lighthouse_key', 1, L('Take the lighthouse key', 'Ambil kunci mercusuar')),
  ]),
  chapter(9, L('The Lighthouse', 'Mercusuar'), [
    count('reach:lighthouse', 1, L('Reach the lighthouse on the north cape', 'Capai mercusuar di tanjung utara')),
    count('boss:hollowkeeper', 1, L('Defeat the Hollow Keeper', 'Kalahkan Hollow Keeper')),
    have('beacon_core', 1, L('Take the beacon core', 'Ambil inti mercusuar')),
  ]),
  chapter(10, L('Set Sail', 'Berlayar'), [
    count('craft:sailcloth', 1, L('Make sailcloth', 'Buat layar')),
    count('craft:raft', 1, L('Build a raft', 'Buat rakit')),
    count('build:raft', 1, L('Put the raft down on the shore', 'Letakkan rakit di pantai')),
    count('ending', 1, L("Decide the island's fate", 'Tentukan nasib pulau ini')),
  ]),
];

/** Ten side quests. Each is offered by one islander and handed in to the same one. */
const SIDE: QuestDef[] = [
  side('cat', 'tali', 'c1', L('Lost Cat', 'Kucing Hilang'), [
    count('cat', 1, L("Find Tali's cat in the forest", 'Temukan kucing Tali di hutan')),
    count('talk:tali', 1, L('Return to Tali', 'Kembali ke Tali'), true),
  ], [{ item: 'bandage', qty: 3 }]),
  side('recipes', 'nia', 'c2', L("Grandma's Recipes", 'Resep Nenek'), [
    count('cook', 3, L('Cook 3 dishes at a campfire', 'Masak 3 hidangan di api unggun')),
    count('talk:nia', 1, L('Show Nia your cooking', 'Tunjukkan masakanmu ke Nia'), true),
  ], [{ item: 'honey', qty: 3 }]),
  side('treasure', 'marlo', 'c3', L('Treasure Map', 'Peta Harta'), [
    count('dig', 3, L('Dig up 3 treasure spots (marked X) with a shovel', 'Gali 3 tempat harta (bertanda X) dengan sekop')),
    count('talk:marlo', 1, L('Tell Marlo', 'Beritahu Marlo'), true),
  ], [{ item: 'arrow', qty: 12 }]),
  side('catch', 'odo', 'c2', L('The Big Catch', 'Tangkapan Besar'), [
    count('fish:big', 1, L('Catch a rare fish with a fishing rod', 'Tangkap ikan langka dengan pancing')),
    count('talk:odo', 1, L('Show Odo', 'Tunjukkan ke Odo'), true),
  ], [{ item: 'rope', qty: 4 }]),
  side('pickaxe', 'brock', 'c5', L("Brock's Pickaxe", 'Beliung Brock'), [
    have('lost_pickaxe', 1, L("Find Brock's pickaxe in the Deepmine", 'Temukan beliung Brock di Tambang Dalam')),
    count('talk:brock', 1, L('Return it to Brock', 'Kembalikan ke Brock'), true),
  ], [{ item: 'iron_ingot', qty: 3 }]),
  side('harvest', 'tali', 'c2', L('Harvest Season', 'Musim Panen'), [
    count('harvest', 10, L('Harvest 10 crops', 'Panen 10 tanaman')),
    count('talk:tali', 1, L('Tell Tali', 'Beritahu Tali'), true),
  ], [{ item: 'pumpkin_seed', qty: 5 }]),
  side('boars', 'tali', 'c1', L('Boar Trouble', 'Masalah Babi Hutan'), [
    count('kill:boar', 3, L('Drive off 3 boars', 'Usir 3 babi hutan')),
    count('talk:tali', 1, L('Tell Tali', 'Beritahu Tali'), true),
  ], [{ item: 'cooked_meat', qty: 4 }]),
  side('bottles', 'marlo', 'c3', L('Message in a Bottle', 'Pesan dalam Botol'), [
    count('bottle', 5, L('Find 5 bottles washed up on the beaches', 'Temukan 5 botol terdampar di pantai')),
    count('talk:marlo', 1, L('Bring the messages to Marlo', 'Bawa pesan-pesan itu ke Marlo'), true),
  ], [{ item: 'small_key', qty: 1 }]),
  side('watch', 'marlo', 'c2', L('Night Watch', 'Jaga Malam'), [
    count('nightwatch', 1, L('Spend a night awake beside a fire or torch', 'Lewati satu malam terjaga di dekat api atau obor')),
    count('talk:marlo', 1, L('Tell Marlo', 'Beritahu Marlo'), true),
  ], [{ item: 'torch', qty: 6 }]),
  side('tablets', 'nia', 'c7', L('Ruin Tablets', 'Prasasti Reruntuhan'), [
    count('tablet', 4, L('Read 4 tablets near the Sunken Ruin', 'Baca 4 prasasti di dekat Reruntuhan Tenggelam')),
    count('talk:nia', 1, L('Tell Nia', 'Beritahu Nia'), true),
  ], [{ item: 'crystal', qty: 2 }]),
];

export const QUESTS: QuestDefs = Object.fromEntries([...MAIN, ...SIDE].map((q) => [q.id, q]));
export const MAIN_QUEST_IDS: readonly string[] = MAIN.map((q) => q.id);
export const SIDE_QUEST_IDS: readonly string[] = SIDE.map((q) => q.id);
