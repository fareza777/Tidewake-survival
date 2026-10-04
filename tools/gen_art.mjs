// Generates the cinematic intro and onboarding pictures with Recraft. Keys are read from a local file at run time and never stored:
//   node tools/gen_art.mjs "<path to the keys file>" <out dir>
import fs from 'node:fs';
import path from 'node:path';

const [, , keysFile, outDir] = process.argv;
const keyLine = fs.readFileSync(keysFile, 'utf8').split(/\r?\n/).find((l) => /^recraft/i.test(l));
const key = keyLine?.split(':').slice(1).join(':').trim();
if (!key) throw new Error('no Recraft key in the keys file');
fs.mkdirSync(outDir, { recursive: true });

const STYLE = 'pixel art, cinematic cutscene illustration, 16-bit retro adventure game, rich dark teal and indigo night palette with warm amber highlights, detailed, atmospheric, no text, no letters, no watermark';
const HERO = 'a young castaway sailor with spiky orange-blonde hair and a blue tunic';
const JOBS = [
  ['intro1', '1024x1820', `${STYLE}. A wooden sailing ship breaking apart in a violent storm at night, huge dark waves, a lightning bolt splitting the sky, torn sails, vertical composition`],
  ['intro2', '1024x1820', `${STYLE}. ${HERO} clinging to a broken mast plank adrift on a dark stormy sea, wreckage and barrels floating around, moon half hidden behind clouds, vertical composition`],
  ['intro3', '1024x1820', `${STYLE}. ${HERO} lying exhausted on a moonlit sandy beach, gentle foam waves, palm trees, broken planks, a sky full of stars, vertical composition`],
  ['intro4', '1024x1820', `${STYLE}. A mysterious tropical island at night, dark jungle and a mountain, an old stone lighthouse on a high cliff with a faint glowing beacon, fireflies, stars, vertical composition`],
  ['intro5', '1024x1820', `${STYLE}. Seen from behind, ${HERO} holding a wooden axe, standing on a beach at golden sunrise looking toward a forest and mountains, hopeful mood, vertical composition`],
  ['onb1', '1365x1024', `${STYLE}. A cosy survival camp: a crackling campfire, a wooden axe and pickaxe leaning on a log, a tent, cooked fish on a stick, jungle edge at dusk`],
  ['onb2', '1365x1024', `${STYLE}. A dark mossy dungeon entrance carved in a mountain with glowing runes, a huge stone guardian silhouette inside, torches, mystery and adventure`],
  ['onb3', '1365x1024', `${STYLE}. ${HERO} swinging a wooden axe against a big tree, wood chips flying, bright forest clearing, action pose`],
];

for (const [name, size, prompt] of JOBS) {
  const file = path.join(outDir, `${name}.png`);
  if (fs.existsSync(file)) continue;
  const res = await fetch('https://external.api.recraft.ai/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, style: 'digital_illustration', substyle: 'pixel_art', size, model: 'recraftv3', n: 1 }),
  });
  const json = await res.json();
  if (!res.ok) { console.log(name, 'FAILED', res.status, JSON.stringify(json).slice(0, 200)); continue; }
  const img = await fetch(json.data[0].url);
  fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
  console.log(name, 'ok');
}
