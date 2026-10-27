import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const play=path.join(root,'playstore');
const shots=path.join(play,'screenshots');
fs.mkdirSync(shots,{recursive:true});
const data=(p,mime='image/png')=>`data:${mime};base64,${fs.readFileSync(path.join(root,p)).toString('base64')}`;
const fonts=`@font-face{font-family:Cinzel;src:url('${data('remotion/public/fonts/Cinzel.ttf','font/ttf')}')}@font-face{font-family:Condensed;src:url('${data('remotion/public/fonts/BarlowCondensed-Bold.ttf','font/ttf')}');font-weight:700}@font-face{font-family:Barlow;src:url('${data('remotion/public/fonts/Barlow-Medium.ttf','font/ttf')}')}`;
const wide=data('art/archipelago-keyart-wide.png');
const portrait=data('art/archipelago-keyart-portrait.png');
const icon=data('art/compass-icon-master.png');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({deviceScaleFactor:1});
const page=await context.newPage();
async function render(html,w,h,destination){
  await page.setViewportSize({width:w,height:h});
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#06111c}body{font-family:Barlow,Arial;color:#f8f0db}img{display:block} ${html.css||''}</style></head><body>${html.body}</body></html>`);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('[data-fit]')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.textContent));
  if(overflow.length)throw Error(`Text overflow: ${overflow.join(' | ')}`);
  await page.screenshot({path:destination});
}

for(const size of [512,1024])await render({body:`<img src="${icon}" style="width:100%;height:100%;object-fit:cover">`},size,size,path.join(play,`app-icon-${size}.png`));

const banner={css:`.art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,13,24,.6),rgba(3,13,24,.15) 58%,transparent 75%)}.content{position:absolute;left:6.25%;top:15%;width:66%}.eyebrow{font-size:clamp(12px,1.18vw,28px);letter-spacing:.27em;color:#afc7ce}.title{font-family:Cinzel,Georgia;font-weight:800;letter-spacing:-.035em;font-size:clamp(96px,9.6vw,230px);line-height:1.15;margin-top:4.4%;color:#f4d99b;text-shadow:0 3px 20px #0009}.subtitle{font-size:clamp(19px,1.9vw,45px);letter-spacing:.31em;margin-top:.3%;color:#e6eef0}.rule{height:2px;background:linear-gradient(90deg,#c3a76b,transparent);width:59%;margin:5.2% 0 4.5%}.tagline{font-family:Condensed;font-size:clamp(29px,2.9vw,68px);line-height:1.15;letter-spacing:.03em;color:#f5f1e7}.tagline span{color:#6cdddc}`,body:`<img class="art" src="${wide}"><div class="shade"></div><div class="content"><div class="eyebrow">A PIXEL-ART SURVIVAL RPG</div><div class="title" data-fit>TIDEWAKE</div><div class="subtitle">ISLAND SURVIVAL</div><div class="rule"></div><div class="tagline">THE TIDE BROUGHT YOU HERE.<br><span>SURVIVAL IS UP TO YOU.</span></div></div>`};
await render(banner,1024,500,path.join(play,'feature-graphic-1024x500.png'));
await render(banner,2048,1000,path.join(root,'art','feature-graphic-master-2048x1000.png'));

export const concepts=[
  {slug:'01-shipwrecked',a:'SHIPWRECKED.',b:'STILL STANDING.',sub:'Gather. Craft. Fight for your next sunrise.',tag:'ISLAND SURVIVAL',file:'07-night',accent:'#f0cd88',layout:'full'},
  {slug:'02-craft',a:'TURN SCRAPS',b:'INTO SURVIVAL.',sub:'Forge tools, weapons and the gear to go further.',tag:'CRAFTING & PROGRESSION',file:'04-craft',second:'02-gather',accent:'#f0cd88',layout:'craft'},
  {slug:'03-build',a:'BUILD YOUR CAMP.',b:'OWN THE NIGHT.',sub:'Raise defenses. Grow food. Keep the fire alive.',tag:'BUILDING & FARMING',file:'03-camp',accent:'#f2bc74',layout:'full'},
  {slug:'04-islands',a:'FIVE ISLANDS.',b:'NO SAFE SHORES.',sub:'Sail from frozen wilds to volcanic frontiers.',tag:'ARCHIPELAGO EXPLORATION',file:'09-frost',second:'09-ember',accent:'#7de1ed',layout:'duo'},
  {slug:'05-bosses',a:'GO BELOW.',b:'HIT BACK.',sub:'Brave dungeon traps. Challenge powerful bosses.',tag:'DUNGEONS & BOSS BATTLES',file:'11-magmaforge',accent:'#ffad76',layout:'full'},
  {slug:'06-progression',a:'GROW STRONGER.',b:'GO FURTHER.',sub:'Upgrade your loadout. Master six survival skills.',tag:'GEAR & SKILLS',file:'05-gear',second:'06-skills',accent:'#7de1ed',layout:'gear'},
  {slug:'07-seasons',a:'EVERY SEASON',b:'TESTS YOU.',sub:'Face the cold, changing weather and night raids.',tag:'DYNAMIC SURVIVAL',file:'08-winter',accent:'#b4e4fa',layout:'full'},
  {slug:'08-story',a:'YOUR ISLAND.',b:'YOUR STORY.',sub:'Follow the beacon. Find your way home.',tag:'PLAY OFFLINE. SURVIVE YOUR WAY.',file:'13-lighthouse',accent:'#f0cd88',layout:'full'},
];
const compass=`<svg width="710" height="710" viewBox="0 0 710 710" fill="none"><circle cx="355" cy="355" r="341" stroke="currentColor" stroke-width="1"/><circle cx="355" cy="355" r="311" stroke="currentColor" stroke-width="1"/><path d="M355 0V710M0 355H710M104 104L606 606M606 104L104 606" stroke="currentColor" stroke-width="1"/><path d="M355 50L390 320L660 355L390 390L355 660L320 390L50 355L320 320Z" stroke="currentColor" stroke-width="1"/></svg>`;
for(const [i,c] of concepts.entries()){
 const shot=data(`captures/${c.file}.png`);
 const second=c.second?data(`captures/${c.second}.png`):null;
 const media=c.layout==='duo'?`<div class="duo one"><img src="${shot}"><div class="place">FROSTFANG</div></div><div class="duo two"><img src="${second}"><div class="place">EMBERHOLD</div></div>`:c.layout==='gear'?`<div class="gear"><img src="${shot}"></div><div class="skills"><img src="${second}"></div>`:c.layout==='craft'?`<div class="gameframe" style="height:1045px;width:916px;left:82px"><img src="${shot}" style="height:auto;object-fit:initial"></div><div class="skills" style="top:1491px;height:348px"><img src="${second}" style="top:-510px"></div>`:`<div class="gameframe"><img src="${shot}"></div>`;
 await render({css:`.keyart{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.34}.wash{position:absolute;inset:0;background:linear-gradient(#06111cee 0%,#06111ce0 22%,#06111c88 55%,#06111cd9 100%)}.motif{position:absolute;right:-340px;top:220px;color:${c.accent};opacity:.12;rotate:16deg}.brand{position:absolute;left:66px;right:66px;top:46px;display:flex;justify-content:space-between;align-items:center}.wordmark{font-family:Cinzel;font-weight:700;font-size:30px;letter-spacing:4px;color:#edd7a5}.issue{font-size:20px;letter-spacing:3px;color:#9aaeb7}.copy{position:absolute;left:65px;top:116px;right:60px}.headline{font-family:Condensed;font-weight:700;font-size:111px;letter-spacing:-1.1px;line-height:.96;text-shadow:0 3px 20px #0006}.headline .accent{color:${c.accent}}.sub{font-size:29px;line-height:1.3;letter-spacing:.1px;color:#c4d3da;margin-top:19px}.gameframe{position:absolute;left:130px;top:396px;width:820px;height:1457.78px;box-shadow:0 34px 90px #000c;outline:1px solid ${c.accent}88;border-radius:7px;overflow:hidden}.gameframe img{width:100%;height:100%;object-fit:contain}.edge{position:absolute;left:66px;top:399px;height:1450px;width:1px;background:linear-gradient(transparent,${c.accent}66,transparent)}.edge.right{left:auto;right:66px}.footer{position:absolute;bottom:23px;left:66px;right:66px;display:flex;align-items:center;justify-content:space-between;font-size:19px;letter-spacing:3px;color:#bdc9ce}.footer b{color:${c.accent};font-weight:500;font-size:20px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:${c.accent};margin-right:14px;vertical-align:3px}.duo{position:absolute;width:510px;height:1370px;overflow:hidden;box-shadow:0 35px 80px #000b;outline:1px solid ${c.accent}99;border-radius:6px;background:#050d19}.duo img{height:100%;width:auto;max-width:none;position:absolute;left:50%;translate:-50% 0;object-fit:cover}.duo.one{left:62px;top:409px;rotate:-3deg}.duo.two{right:62px;top:486px;rotate:3deg}.place{position:absolute;left:0;right:0;bottom:0;padding:38px 15px 30px;background:linear-gradient(transparent,#030d19eb 35%);font-family:Condensed;font-size:49px;letter-spacing:2px;text-align:center;color:#f3ead8}.gear,.skills{position:absolute;left:82px;width:916px;overflow:hidden;outline:1px solid ${c.accent}88;border-radius:7px;box-shadow:0 26px 70px #0009}.gear{top:405px;height:865px}.gear img{width:100%;height:auto}.skills{top:1320px;height:519px}.skills img{width:100%;height:auto;position:absolute;top:-157px}.cap{position:absolute;right:100px;top:1287px;font-size:18px;letter-spacing:4px;color:#9cb9c8}.embellish{position:absolute;left:67px;top:352px;width:91px;height:3px;background:${c.accent}}`,body:`<img class="keyart" src="${portrait}"><div class="wash"></div><div class="motif">${compass}</div><div class="brand"><span class="wordmark">TIDEWAKE</span><span class="issue">ISLAND SURVIVAL</span></div><div class="copy"><div class="headline" data-fit>${c.a}<br><span class="accent">${c.b}</span></div><div class="sub" data-fit>${c.sub}</div></div><div class="embellish"></div><div class="edge"></div><div class="edge right"></div>${media}${c.layout==='gear'?'<div class="cap">EQUIP. UPGRADE. MASTER.</div>':''}<div class="footer"><span><span class="dot"></span>${c.tag}</span><b>${String(i+1).padStart(2,'0')} / 08</b></div>`},1080,1920,path.join(shots,`${c.slug}-1080x1920.png`));
 console.log(`Exported ${c.slug}`);
}

const thumbs=concepts.map(c=>data(`playstore/screenshots/${c.slug}-1080x1920.png`));
await render({css:'.sheet{padding:38px;display:grid;grid-template-columns:repeat(4,1fr);gap:30px}.sheet img{width:100%;box-shadow:0 5px 25px #0006}.mast{padding:36px 42px 0;font-family:Cinzel;font-size:44px;color:#f0d59c}.small{font-family:Barlow;font-size:20px;color:#a8bdc6;margin-top:10px;letter-spacing:3px}',body:`<div class="mast">TIDEWAKE <div class="small">PLAY STORE CAMPAIGN / ENGLISH / 8 SCREENSHOTS</div></div><div class="sheet">${thumbs.map(t=>`<img src="${t}">`).join('')}</div>`},1600,1640,path.join(root,'screenshot-contact-sheet.jpg'));
await browser.close();
console.log('Store assets exported.');
