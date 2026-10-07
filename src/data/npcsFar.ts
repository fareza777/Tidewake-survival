import type { Cond, NpcDef, Topic } from '@/data/npcs';
import type { Text } from '@/sim/quests';

const L = (en: string, id: string): Text => ({ en, id });
const isNew = (quest: string): Cond => ({ quest, is: 'new' });
const active = (quest: string): Cond => ({ quest, is: 'active' });
const atStep = (quest: string, step: number): Cond => ({ at: quest, step });

/** The people of the far islands: each stands by the dock, trades, and sends the hero after something. */
export const RHEA: NpcDef = {
  id: 'rhea', name: L('Captain Rhea', 'Kapten Rhea'), sprite: 'npc4', near: 'dock', dx: -3, dy: 2, island: 'frost', shop: true,
  topics: [
    {
      when: atStep('c12', 0),
      lines: [
        L('A boat in my harbour! I am Rhea. I came with a crew of twelve; the cold kept six of us.', 'Perahu di pelabuhanku! Aku Rhea. Aku datang dengan dua belas awak; dingin menahan enam dari kami.'),
        L('The Glacier King sleeps in the Frostfang Cave and the whole island shivers with him. Dress warm, hunt for hide and keep a fire near.', 'Raja Gletser tidur di Gua Taring Beku dan seluruh pulau menggigil bersamanya. Berpakaianlah hangat, buru kulit dan dekat-dekat api.'),
        L('Bring me his sigil and I will sail you to the next shore myself. My shop is open, if gold is what you carry.', 'Bawakan lambangnya dan aku sendiri yang akan mengantarmu ke pantai berikutnya. Tokoku buka, kalau kau membawa emas.'),
      ],
    },
    { when: atStep('frostrun', 1), lines: [L('The ice slimes have gone quiet. Take this, you have earned it twice over.', 'Lendir es sudah tenang. Ambil ini, kau pantas dua kali lipat.')] },
    { when: atStep('icebones', 1), lines: [L('Their bones were my crew once. Thank you for laying them down.', 'Tulang-tulang itu dulu awakku. Terima kasih sudah membaringkan mereka.')] },
    {
      when: isNew('frostrun'), start: 'frostrun',
      lines: [L('The frost slimes creep into my camp at night. Could you cut down six of them?', 'Lendir beku merayap ke kemahku malam hari. Bisa kau tebas enam ekor?')],
    },
    {
      when: isNew('icebones'), start: 'icebones',
      lines: [L('Frozen skeletons walk the cliffs, wearing what is left of my crew. Put four of them to rest.', 'Rangka beku berjalan di tebing, memakai sisa awakku. Istirahatkan empat dari mereka.')],
    },
    { when: active('frostrun'), lines: [L('Six frost slimes. They love the snow near the cave.', 'Enam lendir beku. Mereka suka salju dekat gua.')] },
    { when: active('icebones'), lines: [L('Four frozen skeletons, on the cliffs. A strong sword helps.', 'Empat rangka beku, di tebing. Pedang kuat membantu.')] },
  ],
  idle: [
    L('Warmth first. Everything else second. That is how you live up here.', 'Hangat dulu. Sisanya belakangan. Begitulah caranya hidup di sini.'),
    L('A coat of hide, a fire at your back, and never sleep in the open.', 'Mantel kulit, api di punggungmu, dan jangan pernah tidur di tempat terbuka.'),
  ],
};

export const KAEL: NpcDef = {
  id: 'kael', name: L('Kael the Smith', 'Kael si Pandai Besi'), sprite: 'npc9', near: 'dock', dx: -3, dy: 2, island: 'ember', shop: true,
  topics: [
    {
      when: atStep('c13', 0),
      lines: [
        L('Careful, the ground bites here. I am Kael. I came for the mithril and stayed for the fire.', 'Hati-hati, tanah di sini menggigit. Aku Kael. Aku datang demi mithril dan tinggal demi apinya.'),
        L('Forgeheart beats under the Magma Forge. Every hammer on this island rings in time with it. End it, and the lava will cool.', 'Jantung Tempa berdetak di bawah Tempa Magma. Setiap palu di pulau ini berdentang seirama. Hentikan, dan lavanya akan dingin.'),
        L('Steel plate will keep you alive. A steel pickaxe will get you the mithril. Come back when you are bruised and I will sell you a potion.', 'Pelat baja akan menjagamu. Beliung baja akan memberimu mithril. Kembalilah saat kau memar dan aku jual ramuan.'),
      ],
    },
    { when: atStep('coal', 1), lines: [L('Coal! A whole heap! My furnace has not been this happy in years. Here, for your trouble.', 'Batu bara! Setumpuk! Tungkuku belum sebahagia ini bertahun-tahun. Ini, untuk jerih payahmu.')] },
    { when: atStep('lavacrabs', 1), lines: [L('Those crabs cracked half my anvils. You are a good friend. Take this.', 'Kepiting itu memecahkan separuh landasanku. Kau teman baik. Ambil ini.')] },
    {
      when: isNew('coal'), start: 'coal',
      lines: [L('My furnace is starving. Ten pieces of coal, from the black veins in the ash, and I will pay you well.', 'Tungkuku kelaparan. Sepuluh batu bara, dari urat hitam di abu, dan aku akan membayarmu mahal.')],
    },
    {
      when: isNew('lavacrabs'), start: 'lavacrabs',
      lines: [L('Lava crabs nest in my quarry. Three of them, gone, and I can mine again.', 'Kepiting lava bersarang di tambangku. Tiga ekor, hilang, dan aku bisa menambang lagi.')],
    },
    { when: active('coal'), lines: [L('Ten coal. Black veins and ash rock both give it.', 'Sepuluh batu bara. Urat hitam dan batu abu sama-sama memberinya.')] },
    { when: active('lavacrabs'), lines: [L('Three crabs. Mind the shells, they hit hard.', 'Tiga kepiting. Awas cangkangnya, pukulannya keras.')] },
  ],
  idle: [
    L('Iron bends. Steel holds. Mithril sings.', 'Besi melengkung. Baja bertahan. Mithril bernyanyi.'),
    L('The heat will drain you. Drink often and stay out of the sun.', 'Panasnya akan menguras tenagamu. Minum sering dan hindari matahari.'),
  ],
};

export const SABLE: NpcDef = {
  id: 'sable', name: L('Sable', 'Sable'), sprite: 'npc22', near: 'dock', dx: -3, dy: 2, island: 'wreck', shop: true,
  topics: [
    {
      when: atStep('c14', 0),
      lines: [
        L('You walk like someone the sea has not made up its mind about. I am Sable. I pick what the tide leaves.', 'Kau berjalan seperti orang yang belum diputuskan laut. Aku Sable. Aku memungut apa yang ditinggalkan pasang.'),
        L('A queen lies below the Drowned Crypt. She waits for her fleet to return, and anyone who comes too close joins it.', 'Seorang ratu terbaring di bawah Ruang Makam Tenggelam. Dia menunggu armadanya kembali, dan siapa pun yang mendekat ikut bergabung.'),
        L('Everything on this beach is for sale. Rope, gems, secrets. Gold, of course.', 'Semua di pantai ini dijual. Tali, permata, rahasia. Emas, tentu saja.'),
      ],
    },
    { when: atStep('bones', 1), lines: [L('Bones! You do not flinch. Good. These will buy a lot of quiet nights. Take this.', 'Tulang! Kau tidak gentar. Bagus. Ini akan membeli banyak malam tenang. Ambil ini.')] },
    { when: atStep('pirates', 1), lines: [L('The captains are quiet at last. They owed me. Here, their share.', 'Para kapten akhirnya tenang. Mereka berhutang padaku. Ini bagian mereka.')] },
    {
      when: isNew('bones'), start: 'bones',
      lines: [L('I grind bones for the old charms. Twelve, if you can stomach it.', 'Aku menumbuk tulang untuk jimat lama. Dua belas, kalau kau tahan.')],
    },
    {
      when: isNew('pirates'), start: 'pirates',
      lines: [L('Ghost pirates walk the wrecks at night. Four of them, and the beach is mine again.', 'Bajak laut hantu berjalan di bangkai kapal malam hari. Empat, dan pantai ini kembali milikku.')],
    },
    { when: active('bones'), lines: [L('Twelve bones. The drowned and the crabs carry plenty.', 'Dua belas tulang. Yang tenggelam dan kepiting membawa banyak.')] },
    { when: active('pirates'), lines: [L('Four pirates. They come out when it is dark.', 'Empat bajak laut. Mereka keluar saat gelap.')] },
  ],
  idle: [
    L('The sea keeps what it likes and returns what it does not.', 'Laut menyimpan yang disukainya dan mengembalikan yang tidak.'),
    L('Do not follow the lights in the water.', 'Jangan ikuti cahaya di air.'),
  ],
};

export const AERO: NpcDef = {
  id: 'aero', name: L('Aero', 'Aero'), sprite: 'npc28', near: 'dock', dx: -3, dy: 2, island: 'sky', shop: true,
  topics: [
    {
      when: atStep('c15', 0),
      lines: [
        L('You climbed the whole way up here in a boat? The wind approves. I am Aero, keeper of the last dock.', 'Kau naik sampai sini dengan perahu? Angin menyetujuinya. Aku Aero, penjaga dermaga terakhir.'),
        L('Above the clouds stands the Sky Spire and the Storm Titan inside it. He is the reason the sea is angry.', 'Di atas awan berdiri Menara Langit dan Titan Badai di dalamnya. Dialah alasan laut marah.'),
        L('Bring his sigil down, and the four of them together will wake the great beacon. I will keep your supplies dry.', 'Bawa lambangnya turun, dan keempatnya bersama akan membangunkan mercusuar agung. Aku akan menjaga bekalmu tetap kering.'),
      ],
    },
    { when: atStep('storms', 1), lines: [L('The sky is quieter already. Take this, it was given to me by the last storm.', 'Langit sudah lebih tenang. Ambil ini, diberikan padaku oleh badai terakhir.')] },
    { when: atStep('gems', 1), lines: [L('Six crystals, humming like a choir. Thank you. They keep the dock afloat.', 'Enam kristal, berdengung seperti paduan suara. Terima kasih. Kristal ini menjaga dermaga tetap terapung.')] },
    {
      when: isNew('storms'), start: 'storms',
      lines: [L('Storm ghosts roam the plateau, charging the clouds. Four of them, and the lightning will leave the dock alone.', 'Hantu badai berkeliaran di dataran tinggi, mengisi awan. Empat ekor, dan petir akan meninggalkan dermaga.')],
    },
    {
      when: isNew('gems'), start: 'gems',
      lines: [L('The dock runs on crystal. Six pieces, from the veins in the stone.', 'Dermaga ini hidup dari kristal. Enam keping, dari urat di batu.')],
    },
    { when: active('storms'), lines: [L('Four storm ghosts. They drift on the plateau.', 'Empat hantu badai. Mereka melayang di dataran tinggi.')] },
    { when: active('gems'), lines: [L('Six crystals. The stone veins hold them.', 'Enam kristal. Urat batu menyimpannya.')] },
  ],
  idle: [
    L('Mind the edge. The wind does not.', 'Awas tepinya. Angin tidak peduli.'),
    L('Some say the sky was once a sea.', 'Ada yang bilang langit dulunya laut.'),
  ],
};

/** What the old islanders say about the new chapters, ahead of what they said before. */
export const EXTRA_TOPICS: Partial<Record<'marlo' | 'nia' | 'brock' | 'tali' | 'odo', Topic[]>> = {
  marlo: [
    {
      when: atStep('c11', 0),
      lines: [
        L('So the lighthouse is lit and the sea still rages. Listen, I have heard of other shores, four of them, beyond the reef.', 'Jadi mercusuar sudah menyala dan laut masih mengamuk. Dengar, aku pernah mendengar pantai lain, empat, di balik karang.'),
        L('A raft cannot reach them, but a boat can: sixteen planks, six ropes and two sailcloth, at a workbench. Set it down by the shore and use it.', 'Rakit tak sampai ke sana, tapi perahu bisa: enam belas papan, enam tali dan dua layar, di meja kerja. Taruh di pantai dan pakai.'),
      ],
    },
    {
      when: atStep('c16', 4),
      lines: [
        L('All four sigils. I never thought I would see them in one hand.', 'Keempat lambang. Tak pernah kukira akan melihatnya di satu tangan.'),
        L('Hold them to the beacon and the whole archipelago will see it. The storms have been waiting for a reason to stop.', 'Pegang di depan mercusuar dan seluruh kepulauan akan melihatnya. Badai menunggu alasan untuk berhenti.'),
        L('You are no castaway any more. You are the keeper of these waters. Go and sail them as you wish.', 'Kau bukan lagi orang terdampar. Kau penjaga perairan ini. Pergilah dan berlayarlah sesukamu.'),
      ],
    },
  ],
};
