import { L, chapter, count, have, side } from '@/data/questKit';
import type { QuestDef } from '@/sim/quests';

/** Acts two and three: the boat, the four far islands and what waits at the end of the archipelago. They open once the lighthouse is lit. */
export const ACT2_MAIN: QuestDef[] = [
  chapter(11, L('The Sea Beyond', 'Laut di Seberang'), [
    count('craft:boat', 1, L('Craft a boat at a workbench', 'Buat perahu di meja kerja')),
    count('build:boat', 1, L('Put the boat down on the shore', 'Letakkan perahu di pantai')),
    count('island:frost', 1, L('Sail to Frostfang', 'Berlayar ke Taring Beku')),
  ], { after: 'c9', reward: [{ item: 'gold', qty: 60 }] }),
  chapter(12, L('Frostfang', 'Taring Beku'), [
    count('talk:rhea', 1, L('Talk to Captain Rhea', 'Bicara dengan Kapten Rhea'), true),
    count('reach:frostcave', 1, L('Find the Frostfang Cave', 'Temukan Gua Taring Beku')),
    count('boss:glacierking', 1, L('Defeat the Glacier King', 'Kalahkan Raja Gletser')),
    count('claim:frostcave', 1, L('Take the frost sigil', 'Ambil lambang beku')),
  ], { reward: [{ item: 'gold', qty: 120 }] }),
  chapter(13, L('Emberhold', 'Benteng Bara'), [
    count('island:ember', 1, L('Sail to Emberhold', 'Berlayar ke Benteng Bara')),
    count('talk:kael', 1, L('Talk to Kael the smith', 'Bicara dengan Kael si pandai besi'), true),
    count('boss:forgeheart', 1, L('Defeat Forgeheart', 'Kalahkan Jantung Tempa')),
    count('claim:magmaforge', 1, L('Take the ember sigil', 'Ambil lambang bara')),
  ], { reward: [{ item: 'gold', qty: 160 }] }),
  chapter(14, L('Bonepool', 'Kolam Tulang'), [
    count('island:wreck', 1, L('Sail to Bonepool', 'Berlayar ke Kolam Tulang')),
    count('talk:sable', 1, L('Talk to Sable', 'Bicara dengan Sable'), true),
    count('boss:drownedqueen', 1, L('Defeat the Drowned Queen', 'Kalahkan Ratu Tenggelam')),
    count('claim:drownedcrypt', 1, L('Take the tide sigil', 'Ambil lambang pasang')),
  ], { reward: [{ item: 'gold', qty: 220 }] }),
  chapter(15, L('Skyreach', 'Jangkauan Langit'), [
    count('island:sky', 1, L('Sail to Skyreach', 'Berlayar ke Jangkauan Langit')),
    count('talk:aero', 1, L('Talk to Aero', 'Bicara dengan Aero'), true),
    count('boss:stormtitan', 1, L('Defeat the Storm Titan', 'Kalahkan Titan Badai')),
    count('claim:skyspire', 1, L('Take the sky sigil', 'Ambil lambang langit')),
  ], { reward: [{ item: 'gold', qty: 300 }] }),
  chapter(16, L('The Four Sigils', 'Empat Lambang'), [
    have('frost_sigil', 1, L('Keep the frost sigil', 'Simpan lambang beku')),
    have('ember_sigil', 1, L('Keep the ember sigil', 'Simpan lambang bara')),
    have('tide_sigil', 1, L('Keep the tide sigil', 'Simpan lambang pasang')),
    have('sky_sigil', 1, L('Keep the sky sigil', 'Simpan lambang langit')),
    count('talk:marlo', 1, L('Show Marlo the four sigils', 'Tunjukkan empat lambang itu ke Marlo'), true),
  ], { reward: [{ item: 'gold', qty: 500 }] }),
];

export const ACT2_SIDE: QuestDef[] = [
  side('frostrun', 'rhea', 'c12', L('Frost Slimes', 'Lendir Beku'), [
    count('kill:frostslime', 6, L('Defeat 6 frost slimes', 'Kalahkan 6 lendir beku')),
    count('talk:rhea', 1, L('Tell Rhea', 'Beritahu Rhea'), true),
  ], [{ item: 'gold', qty: 80 }, { item: 'hide', qty: 3 }]),
  side('icebones', 'rhea', 'c12', L('Frozen Crew', 'Awak Beku'), [
    count('kill:icebone', 4, L('Lay 4 frozen skeletons to rest', 'Istirahatkan 4 rangka beku')),
    count('talk:rhea', 1, L('Tell Rhea', 'Beritahu Rhea'), true),
  ], [{ item: 'gold', qty: 100 }, { item: 'steel_ingot', qty: 1 }]),
  side('coal', 'kael', 'c13', L('A Hungry Furnace', 'Tungku Kelaparan'), [
    have('coal', 10, L('Bring Kael 10 coal', 'Bawakan Kael 10 batu bara')),
    count('talk:kael', 1, L('Hand it to Kael', 'Serahkan ke Kael'), true),
  ], [{ item: 'gold', qty: 90 }, { item: 'mithril_ore', qty: 1 }]),
  side('lavacrabs', 'kael', 'c13', L('Crab in the Quarry', 'Kepiting di Tambang'), [
    count('kill:lavacrab', 3, L('Defeat 3 lava crabs', 'Kalahkan 3 kepiting lava')),
    count('talk:kael', 1, L('Tell Kael', 'Beritahu Kael'), true),
  ], [{ item: 'gold', qty: 120 }]),
  side('bones', 'sable', 'c14', L('Bone Grinder', 'Penumbuk Tulang'), [
    have('bone', 12, L('Bring Sable 12 bones', 'Bawakan Sable 12 tulang')),
    count('talk:sable', 1, L('Hand them to Sable', 'Serahkan ke Sable'), true),
  ], [{ item: 'gold', qty: 110 }, { item: 'crystal', qty: 2 }]),
  side('pirates', 'sable', 'c14', L('Ghost Captains', 'Kapten Hantu'), [
    count('kill:pirate', 4, L('Defeat 4 ghost pirates', 'Kalahkan 4 bajak laut hantu')),
    count('talk:sable', 1, L('Tell Sable', 'Beritahu Sable'), true),
  ], [{ item: 'gold', qty: 140 }]),
  side('storms', 'aero', 'c15', L('Storm Chasers', 'Pemburu Badai'), [
    count('kill:stormghost', 4, L('Defeat 4 storm ghosts', 'Kalahkan 4 hantu badai')),
    count('talk:aero', 1, L('Tell Aero', 'Beritahu Aero'), true),
  ], [{ item: 'gold', qty: 160 }, { item: 'potion_swift', qty: 2 }]),
  side('gems', 'aero', 'c15', L('The Crystal Dock', 'Dermaga Kristal'), [
    have('crystal', 6, L('Bring Aero 6 crystals', 'Bawakan Aero 6 kristal')),
    count('talk:aero', 1, L('Hand them to Aero', 'Serahkan ke Aero'), true),
  ], [{ item: 'gold', qty: 150 }, { item: 'mithril_ingot', qty: 1 }]),
];
