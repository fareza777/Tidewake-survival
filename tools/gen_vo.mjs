// Records the intro narration with ElevenLabs. The key is read from a local file at run time and never stored:
//   node tools/gen_vo.mjs "<path to the keys file>" <out dir>
import fs from 'node:fs';
import path from 'node:path';

const [, , keysFile, outDir] = process.argv;
const keyLine = fs.readFileSync(keysFile, 'utf8').split(/\r?\n/).find((l) => /^eleven/i.test(l));
const key = keyLine?.split(':').slice(1).join(':').trim();
if (!key) throw new Error('no ElevenLabs key in the keys file');

/** George: a warm, captivating storyteller. */
const VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const LINES = {
  en: [
    'Three nights ago, a storm tore the Tidewake apart.',
    'The sea took your crew, your cargo... everything, except a single plank of wood.',
    'You woke alone on a moonlit beach, with nothing but the clothes you wear.',
    'But this island is not empty. High on the cliff, an old lighthouse is waiting.',
    'Gather. Build. Survive. And learn why the tide brought you here.',
  ],
  id: [
    'Tiga malam lalu, badai mengoyak kapal Tidewake hingga berkeping-keping.',
    'Laut merenggut awak kapal, muatan... segalanya, kecuali sebilah papan kayu.',
    'Kau terbangun sendirian di pantai bermandikan bulan, hanya dengan pakaian di badan.',
    'Tapi pulau ini tidak kosong. Di atas tebing, sebuah mercusuar tua menunggu.',
    'Kumpulkan. Bangun. Bertahan. Dan cari tahu mengapa ombak membawamu ke sini.',
  ],
};

for (const [lang, lines] of Object.entries(LINES)) {
  fs.mkdirSync(path.join(outDir, lang), { recursive: true });
  for (let i = 0; i < lines.length; i++) {
    const file = path.join(outDir, lang, `intro${i + 1}.mp3`);
    if (fs.existsSync(file)) continue;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: lines[i], model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
      }),
    });
    if (!res.ok) { console.log(lang, i + 1, 'FAILED', res.status, (await res.text()).slice(0, 200)); continue; }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(lang, i + 1, 'ok', fs.statSync(file).size);
  }
}
