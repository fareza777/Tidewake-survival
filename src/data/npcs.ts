import { AERO, EXTRA_TOPICS, KAEL, RHEA, SABLE } from '@/data/npcsFar';
import type { IslandId, LandmarkId } from '@/sim/world/types';
import type { Text } from '@/sim/quests';

export type NpcId = 'marlo' | 'nia' | 'brock' | 'tali' | 'odo' | 'rhea' | 'kael' | 'sable' | 'aero';
export const NPC_IDS: readonly NpcId[] = ['marlo', 'nia', 'brock', 'tali', 'odo', 'rhea', 'kael', 'sable', 'aero'];

/** When a thing to say applies, judged from the quests. `new` means unlocked but not started. */
export type Cond =
  | { quest: string; is: 'new' | 'active' | 'done' }
  | { at: string; step: number }
  | { all: readonly Cond[] };

export interface Topic {
  when: Cond;
  lines: readonly Text[];
  /** A side quest that begins with this talk. */
  start?: string;
}

export interface NpcDef {
  id: NpcId;
  name: Text;
  /** Sprite group in the actors atlas (`npc19/walk/down/0`...). */
  sprite: string;
  /** Stands this far from a landmark (a free tile nearby is found if the spot is taken). */
  near: LandmarkId;
  dx: number;
  dy: number;
  /** The island they live on (the home island when absent). */
  island?: IslandId;
  /** They buy and sell. */
  shop?: boolean;
  /** The first topic whose condition holds is what they say. */
  topics: readonly Topic[];
  /** What they say when nothing else applies. */
  idle: readonly Text[];
}

const L = (en: string, id: string): Text => ({ en, id });
const at = (quest: string, step: number): Cond => ({ at: quest, step });
const isNew = (quest: string): Cond => ({ quest, is: 'new' });
const active = (quest: string): Cond => ({ quest, is: 'active' });

const MARLO: NpcDef = {
  id: 'marlo', name: L('Marlo', 'Marlo'), sprite: 'npc19', near: 'sailor', dx: 0, dy: 2,
  topics: [
    {
      when: at('c3', 1),
      lines: [
        L('Ha! Another soul washed up on my beach. I am Marlo. I sailed these waters before the storms.', 'Ha! Satu lagi jiwa terdampar di pantaiku. Aku Marlo. Aku berlayar di perairan ini sebelum badai datang.'),
        L('A raft can carry you home, if you build it right. It needs a compass, hull planks and sailcloth.', 'Rakit bisa membawamu pulang, kalau dibuat dengan benar. Butuh kompas, papan lambung dan layar.'),
        L('The compass lies deep in the Mushroom Grotto, the planks in the Deepmine. Sailcloth you can weave from fiber.', 'Kompas ada di dalam Gua Jamur, papannya di Tambang Dalam. Layar bisa kau anyam dari serat.'),
      ],
    },
    { when: at('treasure', 1), lines: [L('Three holes dug and three chests of old treasure! You have the nose of a pirate. Take these arrows.', 'Tiga lubang digali dan tiga peti harta lama! Hidungmu setajam bajak laut. Ambil anak panah ini.')] },
    { when: at('bottles', 1), lines: [L('Five bottles! So the sea did not swallow them all. Their words are the island\'s memory. Take this key for your trouble.', 'Lima botol! Jadi laut tidak menelan semuanya. Kata-kata di dalamnya adalah ingatan pulau ini. Ambil kunci ini.')] },
    { when: at('watch', 1), lines: [L('You stood the night and the dark did not take you. A sailor respects that. Here, torches for the next one.', 'Kau bertahan semalaman dan gelap tidak membawamu. Pelaut menghormati itu. Ini obor untuk malam berikutnya.')] },
    {
      when: isNew('treasure'), start: 'treasure',
      lines: [
        L('I once buried three chests on this island, then forgot where. The old map is gone, but the spots are marked with an X.', 'Dulu aku mengubur tiga peti di pulau ini, lalu lupa di mana. Petanya hilang, tapi tempatnya bertanda X.'),
        L('The chests stand where the X marks the sand. Walk up, face one and tap USE.', 'Peti-peti itu ada di tempat tanda X di pasir. Datangi, hadap salah satu dan tekan USE.'),
      ],
    },
    {
      when: isNew('bottles'), start: 'bottles',
      lines: [
        L('I threw messages into the sea for years. Some came back. Find five bottles on the beaches and bring me what they say.', 'Bertahun-tahun aku melempar pesan ke laut. Sebagian kembali. Temukan lima botol di pantai dan bawa isinya padaku.'),
      ],
    },
    {
      when: isNew('watch'), start: 'watch',
      lines: [
        L('Want to know the island? Stay awake one night beside a fire or a torch, and watch. The dark teaches.', 'Mau mengenal pulau ini? Tetaplah terjaga semalam di dekat api atau obor, dan perhatikan. Kegelapan mengajar.'),
      ],
    },
    { when: active('treasure'), lines: [L('Open the chests where the X marks the sand. Three of them.', 'Bukalah peti di tempat tanda X. Ada tiga.')] },
    { when: active('bottles'), lines: [L('Keep walking the beaches. The tide leaves bottles in quiet corners.', 'Terus susuri pantai. Pasang meninggalkan botol di sudut-sudut sepi.')] },
    { when: active('watch'), lines: [L('Do not sleep. Light a fire or a torch and let the night pass over you.', 'Jangan tidur. Nyalakan api atau obor dan biarkan malam lewat di atasmu.')] },
    {
      when: at('c10', 3),
      lines: [
        L('The raft, at last. Sail home, or stay and light the lighthouse again. A ship that knows the light will come back.', 'Rakitnya akhirnya jadi. Berlayarlah pulang, atau tinggal dan nyalakan lagi mercusuar. Kapal yang mengenal cahaya akan kembali.'),
        L('I will not tell you which. I only say the island needs a keeper.', 'Aku tidak akan bilang pilih yang mana. Aku hanya bilang pulau ini butuh penjaga.'),
      ],
    },
    {
      when: active('c10'),
      lines: [
        L('A raft needs a compass, hull planks, sailcloth and a good deal of rope and plank. Have you got them all?', 'Rakit butuh kompas, papan lambung, kain layar, dan banyak tali serta papan. Sudah kau kumpulkan semua?'),
      ],
    },
  ],
  idle: [
    L('The sea is quiet today. Too quiet.', 'Laut tenang hari ini. Terlalu tenang.'),
    L('Mind the grotto, castaway. Big things sleep there.', 'Hati-hati dengan gua itu, anak muda. Ada makhluk besar tidur di sana.'),
  ],
};

const NIA: NpcDef = {
  id: 'nia', name: L('Nia', 'Nia'), sprite: 'npc15', near: 'herbalist', dx: 0, dy: 2,
  topics: [
    {
      when: at('c7', 1),
      lines: [
        L('You walked through the swamp and you are still on your feet. The fever is in the air here.', 'Kau berjalan melewati rawa dan masih berdiri. Demamnya ada di udara sini.'),
        L('An antidote helps. Cook two slime gel, three fiber and two berries over a campfire. Bring it back to me.', 'Penawar bisa membantu. Masak dua lendir slime, tiga serat dan dua beri di atas api unggun. Bawa kembali padaku.'),
      ],
    },
    {
      when: at('c7', 3),
      lines: [
        L('It works! Already the shaking stops. The swamp camp is yours to use, and so is my thanks.', 'Berhasil! Gemetarnya sudah berhenti. Kemah rawa ini boleh kau pakai, dan terima kasihku juga.'),
        L('Go find the desert. The Sunken Ruin keeps the key to the lighthouse.', 'Pergilah mencari gurun. Reruntuhan Tenggelam menyimpan kunci mercusuar.'),
      ],
    },
    { when: at('recipes', 1), lines: [L('Roasted, baked and honest. My grandmother would have wept. Take this honey.', 'Dipanggang, dipanggang dan jujur. Nenekku pasti terharu. Ambil madu ini.')] },
    { when: at('tablets', 1), lines: [L('So the tablets speak of a keeper who never left. Take these crystals, you earned them.', 'Jadi prasasti itu bicara tentang penjaga yang tak pernah pergi. Ambil kristal ini, kau layak mendapatkannya.')] },
    {
      when: isNew('recipes'), start: 'recipes',
      lines: [
        L('My grandmother left me recipes, but the pot has been cold for years. Cook three dishes over a campfire and let me taste them.', 'Nenekku meninggalkan resep, tapi periuknya dingin bertahun-tahun. Masak tiga hidangan di atas api unggun dan biar aku mencicipinya.'),
      ],
    },
    {
      when: isNew('tablets'), start: 'tablets',
      lines: [
        L('Old stone tablets stand near the Sunken Ruin. I cannot read them from here. Find four and tell me what they say.', 'Prasasti batu tua berdiri dekat Reruntuhan Tenggelam. Aku tak bisa membacanya dari sini. Temukan empat dan ceritakan isinya.'),
      ],
    },
    { when: active('recipes'), lines: [L('Meat, roots, fish: anything cooked over fire counts. Three dishes.', 'Daging, umbi, ikan: apa pun yang dimasak di atas api dihitung. Tiga hidangan.')] },
    { when: active('tablets'), lines: [L('Four tablets, near the ruin in the desert. Read each one.', 'Empat prasasti, dekat reruntuhan di gurun. Baca satu per satu.')] },
    { when: { quest: 'c7', is: 'active' }, lines: [L('The antidote: slime gel, fiber and berries, cooked at a campfire.', 'Penawar: lendir slime, serat dan beri, dimasak di api unggun.')] },
  ],
  idle: [
    L('The swamp gives and the swamp takes. Mostly takes.', 'Rawa memberi dan rawa mengambil. Kebanyakan mengambil.'),
    L('Drink river water, never the sea.', 'Minumlah air sungai, jangan air laut.'),
  ],
};

const BROCK: NpcDef = {
  id: 'brock', name: L('Brock', 'Brock'), sprite: 'npc26', near: 'miner', dx: 0, dy: 2,
  topics: [
    { when: at('pickaxe', 1), lines: [L('My old pickaxe! Rusty, but she still rings true. Here, ingots for the trouble.', 'Beliung tuaku! Berkarat, tapi masih nyaring. Ini, besi batang untuk jerih payahmu.')] },
    {
      when: isNew('pickaxe'), start: 'pickaxe',
      lines: [
        L('I lost my pickaxe in the Deepmine when the skeletons came. Without it I am just a man in a tent.', 'Aku kehilangan beliungku di Tambang Dalam saat kerangka datang. Tanpanya aku hanya orang di dalam tenda.'),
        L('If you go down there, look in the little side room by the entrance. Bring it back and I will pay.', 'Kalau kau turun ke sana, lihat di ruang kecil dekat pintu masuk. Bawa kembali dan akan kubayar.'),
      ],
    },
    { when: active('pickaxe'), lines: [L('The side room near the Deepmine entrance. Small chest. Mind the skeletons.', 'Ruang samping dekat pintu Tambang Dalam. Peti kecil. Awas kerangka.')] },
  ],
  idle: [
    L('Iron needs fire. Fire needs a furnace. Furnace needs stone. Simple.', 'Besi butuh api. Api butuh tungku. Tungku butuh batu. Sederhana.'),
    L('Do not hit ore with wood. Stone at least, iron better.', 'Jangan pukul bijih dengan kayu. Batu paling tidak, besi lebih baik.'),
  ],
};

const TALI: NpcDef = {
  id: 'tali', name: L('Tali', 'Tali'), sprite: 'npc13', near: 'camp', dx: 4, dy: 1,
  topics: [
    { when: at('cat', 1), lines: [L('Mittens! You found her! She is purring already. Please take these bandages.', 'Mittens! Kau menemukannya! Dia sudah mendengkur. Tolong ambil perban ini.')] },
    { when: at('harvest', 1), lines: [L('Ten crops, from seed to basket! You have a farmer\'s hands. Here, pumpkin seeds.', 'Sepuluh tanaman, dari benih ke keranjang! Tanganmu tangan petani. Ini, bibit labu.')] },
    { when: at('boars', 1), lines: [L('The garden is quiet at last! Take some meat, you earned it.', 'Kebun akhirnya tenang! Ambil daging ini, kau pantas mendapatkannya.')] },
    {
      when: isNew('cat'), start: 'cat',
      lines: [
        L('Please, have you seen a small orange cat? Mittens ran off into the forest and I am too scared to go.', 'Tolong, apa kau lihat kucing kecil oranye? Mittens lari ke hutan dan aku terlalu takut untuk pergi.'),
        L('She likes quiet clearings. Find her and I will be so grateful.', 'Dia suka tempat lapang yang tenang. Temukan dia dan aku akan sangat berterima kasih.'),
      ],
    },
    {
      when: isNew('boars'), start: 'boars',
      lines: [
        L('Boars keep tearing up my little garden! Could you drive three of them off?', 'Babi hutan terus merusak kebun kecilku! Bisakah kau mengusir tiga ekor?'),
      ],
    },
    {
      when: isNew('harvest'), start: 'harvest',
      lines: [
        L('Gardening is the best thing on this island. Till some soil with a hoe, plant seeds, water them, and harvest ten crops. Show me!', 'Berkebun hal terbaik di pulau ini. Cangkul tanah, tanam benih, siram, dan panen sepuluh tanaman. Tunjukkan padaku!'),
      ],
    },
    { when: active('cat'), lines: [L('She is orange, with white paws. Somewhere in the forest, I think.', 'Dia oranye, dengan kaki putih. Di suatu tempat di hutan, kurasa.')] },
    { when: active('boars'), lines: [L('Three boars. They live in the forest and the swamp.', 'Tiga babi hutan. Mereka tinggal di hutan dan rawa.')] },
    { when: active('harvest'), lines: [L('A hoe tills, a watering can waters. Ten crops, remember.', 'Cangkul menggemburkan, penyiram menyiram. Sepuluh tanaman, ingat.')] },
  ],
  idle: [
    L('Mittens is the best cat. Do not tell the others.', 'Mittens kucing terbaik. Jangan bilang yang lain.'),
    L('I keep a garden here, near the old camp.', 'Aku merawat kebun di sini, dekat kemah lama.'),
  ],
};

const ODO: NpcDef = {
  id: 'odo', name: L('Odo', 'Odo'), sprite: 'npc20', near: 'start', dx: -6, dy: -1,
  topics: [
    { when: at('catch', 1), lines: [L('A golden carp! In thirty years I never landed one. You have the luck of the tide. Take this rope.', 'Ikan mas emas! Tiga puluh tahun aku tak pernah mendapatkannya. Kau punya keberuntungan pasang. Ambil tali ini.')] },
    {
      when: isNew('catch'), start: 'catch',
      lines: [
        L('Odo, fisher. Ask me about the sea. They say a rare golden fish swims along this shore.', 'Odo, nelayan. Tanya aku soal laut. Katanya ikan emas langka berenang di pantai ini.'),
        L('Make a fishing rod at a workbench, face the water and keep casting. The big one bites rarely.', 'Buat pancing di meja kerja, hadap air dan terus melempar. Yang besar jarang menggigit.'),
      ],
    },
    { when: active('catch'), lines: [L('Rod in hand, face the water, and be patient. A rare fish takes a few casts.', 'Pancing di tangan, hadap air, dan sabar. Ikan langka butuh beberapa lemparan.')] },
  ],
  idle: [
    L('Fish, cooked on a fire, fills the belly better than any berry.', 'Ikan yang dimasak di api mengenyangkan lebih baik dari beri apa pun.'),
    L('The tide tells you everything if you sit long enough.', 'Pasang menceritakan segalanya kalau kau duduk cukup lama.'),
  ],
};

const withExtra = (npc: NpcDef): NpcDef => {
  const more = (EXTRA_TOPICS as Partial<Record<string, Topic[]>>)[npc.id];
  return more ? { ...npc, topics: [...more, ...npc.topics] } : npc;
};

export const NPCS: Record<NpcId, NpcDef> = {
  marlo: withExtra({ ...MARLO, shop: true }), nia: NIA, brock: BROCK, tali: TALI, odo: ODO, rhea: RHEA, kael: KAEL, sable: SABLE, aero: AERO,
};
