import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'captures');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.stack || String(e)));
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => {
  localStorage.setItem('tidewake.onboarded', '1');
  localStorage.setItem('tidewake.tutorial', '1');
  localStorage.setItem('tidewake.settings.v1', JSON.stringify({ lang: 'en', quality: 'high', musicVol: 0,
    sfxVol: 0, screenShake: false, autoAttack: false, joystick: 'fixed' }));
});
await page.goto('http://127.0.0.1:5199/');
await page.waitForFunction(() => window.__game?.scene.isActive('Menu'), null, { timeout: 45000 });
await page.evaluate(() => __game.scene.getScene('Menu').goTo('Game', {slot:0, seed:1234, name:'Ash', difficulty:'normal'}));
await page.waitForFunction(() => __game.scene.isActive('Game') && __game.scene.isActive('Hud'), null, {timeout:30000});
await page.waitForTimeout(2000);
await page.evaluate(async () => {
  const {ITEMS} = await import('/src/data/items.ts');
  const {newCreature} = await import('/src/sim/creatures.ts');
  const {Rng} = await import('/src/core/rng.ts');
  const {CROPS} = await import('/src/data/crops.ts');
  const {weatherAt} = await import('/src/sim/weather.ts');
  const clearDay=Array.from({length:8},(_,i)=>i+1).find(d=>weatherAt(1234,d,180)==='clear')||1;
  const snowDay=Array.from({length:8},(_,i)=>i+25).find(d=>weatherAt(1234,d,180)==='snow')||27;
  window.M = {
    items: ITEMS, newCreature, Rng, crops:CROPS, clearDay,snowDay, g:()=>__game.scene.getScene('Game'),
    gear() {
      const g=this.g();
      const ids=['sword_steel','axe_iron','pickaxe_iron','bow','arrow','cooked_meat','healing_potion','torch',
        'wood','stone','iron_ore','iron_ingot','steel_ingot','mithril_ingot','coal','plank','rope','hide',
        'armor_mithril','helm_crystal','boots_mithril','amulet_fortune','campfire','workbench','furnace','bed',
        'gold','carrot','fiber','sword_crystal','bandage','stamina_tonic'];
      const inventory=ids.map(id=>{
        const def=ITEMS[id]; if(!def)return null;
        return {item:id,qty:Math.min(def.stack, id==='gold'?640:id==='arrow'?48:def.stack>1?12:1),
          ...(def.tool?{dur:def.tool.durability}:{}),...(id==='sword_steel'?{plus:2}:{})};
      });
      g.session={...g.session,inventory,selected:0, equipment:{armor:'armor_mithril',helm:'helm_crystal',boots:'boots_mithril',charm:'amulet_fortune'},
        vitals:{...g.session.vitals,hp:100,hunger:86,thirst:91,stamina:100,warmth:85},
        skills:{woodcutting:1200,mining:2300,combat:4500,farming:1800,cooking:900,crafting:2700},
        quests:{...g.session.quests,active:{},done:['c1','c2','c3']},clock:{day:clearDay,t:180}};
      g.player.face(0,-1);
      const w=g.combat.wildlife; w.state={...w.state,creatures:[],pickups:[],spawnTimer:1e9}; w.apply(w.state,[]);
    },
    cleanHud() { const n=__game.scene.getScene('Notify'); n.children?.list?.forEach(o=>o.setVisible(false)); },
    heal() { const g=this.g();g.session={...g.session,vitals:{...g.session.vitals,hp:100,stamina:100,hunger:86,thirst:91}}; },
    camp() {
      const g=this.g(),w=g.world,S=w.size,c=w.landmarks.find(l=>l.id==='camp')||w.start;
      let best, bestScore=Infinity;
      for(let y=Math.max(10,c.y-22);y<Math.min(S-10,c.y+22);y++)for(let x=Math.max(10,c.x-22);x<Math.min(S-10,c.x+22);x++){
        let bad=0;
        for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
          const i=(y+dy)*S+x+dx; if(w.terrain[i]!==3)bad+=5; if(g.solids.has(i))bad++;
        }
        const score=bad+Math.hypot(x-c.x,y-c.y)*0.03;
        if(score<bestScore){bestScore=score;best={x,y};}
      }
      const x=best.x,y=best.y;
      g.pos={x:x+0.5,y:y+1.5};g.player.face(0,-1);
      const list=[];let id=1;
      const add=(type,dx,dy,extra={})=>list.push({id:id++,type,x:x+dx,y:y+dy,...extra});
      for(let dx=-4;dx<=4;dx++){add('wood_wall',dx,-4);if(Math.abs(dx)>1)add('stone_wall',dx,4);}
      for(let dy=-3;dy<4;dy++){add('wood_wall',-4,dy);add('wood_wall',4,dy);}
      for(let dx=-3;dx<=0;dx++)for(let dy=-3;dy<=-1;dy++)add('wood_floor',dx,dy);
      add('tent',-2,-2);add('workbench',-2,0);add('furnace',-3,2);add('anvil',-1,0);
      add('campfire',1,0);add('bed',-2,-1);add('chest',-3,-1,{inv:Array(24).fill(null)});
      add('torch',-3,-3);add('torch',3,-3);add('turret',3,2,{ammo:25});add('wood_door',0,4);
      g.session={...g.session,structures:{next:id,list},settlers:['farmer','miner'],clock:{day:clearDay,t:180}};
      list.forEach(q=>g.level.structureLayer.add(q));
      const plots={}; const crops=['carrot','wheat','corn','pumpkin'].filter(k=>CROPS[k]);
      for(let dy=-2;dy<=1;dy++)for(let dx=2;dx<=3;dx++)plots[(y+dy)*S+x+dx]={crop:crops[(dy+2)%crops.length],growth:10,watered:true};
      g.session={...g.session,farm:{plots}};
      g.level.farmLayer?.rebuild(g.session.farm);
      g.rebuildBlocking();window.__camp={x,y};return {x,y,bestScore};
    }
  };M.gear();M.cleanHud();
});
if(process.env.CLIPS==='1')await page.clock.install();

async function shot(name) {
  if(process.env.STILLS==='0')return;
  if(process.env.STILLSSELECT&&!process.env.STILLSSELECT.split(',').includes(name))return;
  await page.waitForTimeout(650);
  await page.evaluate(()=>{M.heal();M.cleanHud();});
  await page.screenshot({path:path.join(out,`${name}.png`)});
  console.log(`Captured ${name}`);
}
async function clip(name, seconds, action) {
  if(process.env.CLIPS!=='1')return;
  if(process.env.CLIPSSELECT&&!process.env.CLIPSSELECT.split(',').includes(name))return;
  const dir=path.join(out,'frames',name);fs.mkdirSync(dir,{recursive:true});
  // Freeze wall time and advance the running Phaser simulation by exactly 1/30 s per saved frame.
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
  if(action)await action('start');
  for(let i=0;i<Math.round(seconds*30);i++) {
    if(action)await action(i);
    await page.clock.runFor(1000/30);
    await page.evaluate(()=>M.cleanHud());
    await page.screenshot({path:path.join(dir,`${String(i).padStart(5,'0')}.jpg`),type:'jpeg',quality:86,scale:'device'});
  }
  if(action)await action('end');
  await page.clock.resume();
  console.log(`Recorded ${name}: ${seconds}s`);
}

await shot('00-start');
await page.evaluate(()=>{
  const g=M.g(),l=g.world.landmarks.find(l=>l.id==='start');
  console.log(JSON.stringify(g.world.landmarks));
  g.pos={x:(l?.x||g.world.start.x)+0.5,y:(l?.y||g.world.start.y)+0.5};g.player.face(0,-1);
});
await shot('01-stranded');
await clip('stranded',3,async i=>{if(i==='start')await page.keyboard.down('ArrowUp');if(i==='end')await page.keyboard.up('ArrowUp');});

await page.evaluate(()=>{
  const g=M.g();const tree=g.world.resources.find(r=>r.kind==='tree'&&r.x>20&&r.x<80);
  g.pos={x:tree.x+0.5,y:tree.y+1.5};g.player.face(0,-1);g.session={...g.session,selected:1};
});
await shot('02-gather');
await clip('gather',3,async i=>{if(typeof i==='number'&&i%24===0)await page.evaluate(()=>{M.g().perform(M.g().computeAction());});});
const camp=await page.evaluate(()=>M.camp());console.log('Camp',camp);
await shot('03-camp');
await clip('camp',4,async i=>{if(i==='start')await page.keyboard.down('ArrowLeft');if(i===35)await page.keyboard.up('ArrowLeft');if(i==='end')await page.keyboard.up('ArrowLeft');});
await page.evaluate(()=>{
  const g=M.g(),c=__camp;g.pos={x:c.x-1.5,y:c.y+0.5};g.player.face(0,-1);g.openInventory({mode:'craft'});
});
await page.waitForFunction(()=>__game.scene.isActive('Inventory'));
await shot('04-craft');
await clip('craft',3);
await page.evaluate(()=>__game.scene.getScene('Inventory').switchTab('bag'));
await shot('05-gear');
await clip('gear',3);
await page.evaluate(()=>__game.scene.getScene('Inventory').switchTab('skills'));
await shot('06-skills');
await page.evaluate(()=>__game.scene.getScene('Inventory').close());

await page.evaluate(()=>{
  const g=M.g(),c=__camp;g.pos={x:c.x+0.5,y:c.y+1.5};g.player.face(0,-1);g.session={...g.session,selected:0,clock:{day:3,t:500}};
  const w=g.combat.wildlife;const rng=new M.Rng(1234);
  const creatures=[['skeleton',-2,3],['zombie',3,3],['skeleton_warrior',0,3],['ghost',-3,-2]]
    .map(([kind,dx,dy],i)=>M.newCreature(900+i,kind,c.x+dx+0.5,c.y+dy+0.5,rng));
  w.load({...w.state,creatures,spawnTimer:1e9,nextId:1000});
});
await shot('07-night');
await clip('night',4,async i=>{if(typeof i==='number'&&i%14===0)await page.evaluate(()=>{M.heal();M.g().player.face(0,1);M.g().perform(M.g().computeAction());});});
await page.evaluate(()=>{const g=M.g();g.combat.reset();g.session={...g.session,clock:{day:M.snowDay,t:180}};g.player.face(0,-1);});
await shot('08-winter');
await clip('winter',3);

for(const island of ['frost','ember','sky']) {
  await page.evaluate(id=>{const g=M.g();const d={...g.session.dungeons};for(const k of ['frostcave','magmaforge','drownedcrypt'])d[k]={...d[k],boss:true};g.session={...g.session,dungeons:d,clock:{day:3,t:180}};g.setSail(id);},island);
  await page.waitForFunction(id=>__game.scene.isActive('Game')&&__game.scene.getScene('Game').session.island===id&&!__game.scene.getScene('Game').transitioning,island,{timeout:30000});
  await page.waitForTimeout(750);
  await page.evaluate(()=>{M.gear();const g=M.g(),l=g.world.landmarks.find(l=>!['start','dock','outpost'].includes(l.id));g.pos={x:l.x+0.5,y:l.y+3};g.player.face(0,-1);});
  await shot(`09-${island}`);
  await clip(island,2.5,async i=>{if(i==='start')await page.keyboard.down('ArrowUp');if(i==='end')await page.keyboard.up('ArrowUp');});
}
await page.evaluate(()=>M.g().openVoyage());
await page.waitForFunction(()=>__game.scene.isActive('Voyage'));
await shot('10-voyage');
await page.evaluate(()=>{__game.scene.stop('Voyage');__game.scene.resume('Game');});

for(const dungeon of ['magmaforge','frostcave','grotto']) {
  await page.evaluate(id=>{const g=M.g();g.session={...g.session,location:id,clock:{day:3,t:180},dungeons:{...g.session.dungeons,[id]:{...g.session.dungeons[id],boss:false,claimed:false}}};g.saveNow();g.goTo('Game',{slot:0});},dungeon);
  await page.waitForFunction(id=>{const g=__game.scene.getScene('Game');return __game.scene.isActive('Game')&&g.session.location===id&&g.level.dungeon&&!g.transitioning;},dungeon,{timeout:30000});
  await page.waitForTimeout(700);
  await page.evaluate(()=>{
    M.gear();const g=M.g(),d=g.level.dungeon;
    g.pos={x:d.boss.x+0.5,y:d.boss.y+3};g.player.face(0,-1);g.session={...g.session,selected:0};
    const w=g.combat.wildlife;w.state={...w.state,creatures:[M.newCreature(999,d.boss.kind,d.boss.x+0.5,d.boss.y+0.5,new M.Rng(42))],spawnTimer:1e9};w.apply(w.state,[]);
  });
  await shot(`11-${dungeon}`);
  await clip(dungeon,4,async i=>{
    if(typeof i==='number'&&i%12===0)await page.evaluate(()=>{M.heal();const g=M.g();const b=g.combat.snapshot().creatures.find(c=>c.id===999);if(b)g.player.face(b.x-g.pos.x,b.y-g.pos.y);g.perform(g.computeAction());});
    if(i==='start')await page.keyboard.down('ArrowUp');if(i===24||i==='end')await page.keyboard.up('ArrowUp');
  });
}
await page.evaluate(()=>{const g=M.g();g.session={...g.session,location:'depths',floor:7};g.saveNow();g.goTo('Game',{slot:0});});
await page.waitForFunction(()=>{const g=__game.scene.getScene('Game');return __game.scene.isActive('Game')&&g.session.location==='depths'&&g.level.dungeon&&!g.transitioning;},null,{timeout:30000});
await page.waitForTimeout(900);
await page.evaluate(()=>{M.gear();M.g().player.face(0,-1);});
await shot('12-depths');
await clip('depths',3,async i=>{if(i==='start')await page.keyboard.down('ArrowUp');if(i==='end')await page.keyboard.up('ArrowUp');});

await page.evaluate(()=>{const g=M.g();g.session={...g.session,island:'home',location:null,clock:{day:3,t:250}};g.saveNow();g.goTo('Game',{slot:0});});
await page.waitForFunction(()=>{const g=__game.scene.getScene('Game');return __game.scene.isActive('Game')&&!g.session.location&&g.session.island==='home'&&!g.transitioning;},null,{timeout:30000});
await page.waitForTimeout(700);
await page.evaluate(()=>{M.gear();const g=M.g(),l=g.world.landmarks.find(l=>l.id==='lighthouse');g.pos={x:l.x+0.5,y:l.y+3};g.player.face(0,-1);});
await shot('13-lighthouse');
await clip('lighthouse',3,async i=>{if(i==='start')await page.keyboard.down('ArrowUp');if(i===20||i==='end')await page.keyboard.up('ArrowUp');});
const state=await page.evaluate(()=>({errors:window.__errs,landmarks:M.g().world.landmarks,itemCount:Object.keys(M.items).length}));
fs.writeFileSync(path.join(out,'capture-report.json'),JSON.stringify({viewport:[360,640],dpr:3,seed:1234,language:'en',errors:[...errors,...state.errors],itemCount:state.itemCount,landmarks:state.landmarks,staged:true,description:'Real running game. QA hooks stage inventory, structures, weather and encounters. Temporary notification toasts are hidden for capture; game artwork and primary UI are preserved.'},null,2));
await browser.close();
if(errors.length||state.errors.length)throw new Error(JSON.stringify([...errors,...state.errors]));
console.log('Capture complete, no runtime errors.');

