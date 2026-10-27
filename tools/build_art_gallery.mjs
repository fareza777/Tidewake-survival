import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'output/imagegen/full-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
const labels = {};
for (const file of fs.readdirSync(path.join(root, 'src/data')).filter(name => /^strings.*\.ts$/.test(name))) {
  const text = fs.readFileSync(path.join(root, 'src/data', file), 'utf8');
  for (const match of text.matchAll(/(item_[a-z0-9_]+|dungeon_[a-z0-9_]+)\s*:\s*\{[^}]*?id:\s*'([^']+)'/g)) {
    labels[match[1]] = match[2];
  }
}
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function card(asset) {
  const key = asset.kind === 'item' ? 'item_' + asset.id : 'dungeon_' + asset.dungeon;
  const name = labels[key] ?? asset.id.replace(/^entrance_/, '').replaceAll('_', ' ');
  const image = 'ready/' + asset.file;
  if (!fs.existsSync(path.join(output, image))) throw Error('Missing runtime preview ' + image);
  return '<article class="' + asset.kind + '" data-name="' + escape(name.toLowerCase()) + '"><img src="' + escape(image) + '" alt="' + escape(name) + '"><span>' + escape(name) + '</span></article>';
}
const items = manifest.assets.filter(asset => asset.kind === 'item');
const entrances = manifest.assets.filter(asset => asset.kind === 'entrance');
const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Tidewake · Aset Baru</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b0a14;color:#f4ecd8;font-family:system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:36px}
header{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:28px}h1{font-size:30px;color:#e8b04b;margin:4px 0}header p{margin:0;color:#a79fc2}.eyebrow{font-size:11px;letter-spacing:2px;color:#a79fc2}
input{background:#1d1a33;border:1px solid #5a5189;border-radius:6px;padding:12px;color:#f4ecd8;width:220px}h2{font-size:17px;color:#e8b04b;margin:28px 0 16px}.items{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px}.entrances{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
article{background:#120f22;border:1px solid #3c3563;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:104px;padding:8px 4px;gap:6px}
article img{object-fit:contain;image-rendering:pixelated;width:64px;height:64px}article span{text-align:center;font-size:10px;line-height:1.25;min-height:24px;text-transform:capitalize;color:#d4cbe8}.entrance{min-height:180px;padding:12px}.entrance img{width:128px;height:128px}.entrance span{font-size:13px}.hidden{display:none}
footer{margin-top:24px;color:#a79fc2;font-size:12px}@media(max-width:900px){main{padding:20px}.items{grid-template-columns:repeat(6,minmax(0,1fr))}.entrances{grid-template-columns:repeat(2,minmax(0,1fr))}header{align-items:start;flex-direction:column}}
</style>
<main><header><div><div class="eyebrow">TIDEWAKE · ISLAND SURVIVAL</div><h1>Seluruh Item &amp; Pintu Dungeon</h1><p>${items.length} item · ${entrances.length} pintu masuk · Pixel art transparan</p></div><input type="search" placeholder="Cari item…" aria-label="Cari item"></header>
<h2>Pintu Masuk Dungeon</h2><section class="entrances">${entrances.map(card).join('')}</section>
<h2>Item Inventory</h2><section class="items">${items.map(card).join('')}</section><footer>Gaya mengikuti tiga contoh yang telah disetujui. Semua gambar dibuat dengan imagegen.</footer></main>
<script>document.querySelector('input').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();for(const card of document.querySelectorAll('article'))card.classList.toggle('hidden',!card.dataset.name.includes(q))});</script></html>`;
fs.writeFileSync(path.join(output, 'gallery.html'), html);
console.log('Gallery: ' + items.length + ' items, ' + entrances.length + ' entrances');

