import {bundle} from '@remotion/bundler';
import {getCompositions,openBrowser,renderStill,renderMedia} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const dest=path.resolve(here,'../video');
const defaultEdge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserExecutable=process.env.REMOTION_BROWSER||(fs.existsSync(defaultEdge)?defaultEdge:undefined);
const mode=process.argv[2]||'qa';
const serveUrl=await bundle({entryPoint:path.join(here,'src/index.ts'),publicDir:path.join(here,'public')});
const browser=await openBrowser('chrome',{browserExecutable});
const comps=await getCompositions(serveUrl,{puppeteerInstance:browser});
fs.mkdirSync(dest,{recursive:true});
try{
 for(const id of ['Tidewake-PlayStore','Tidewake-Vertical']){
  const composition=comps.find(c=>c.id===id);
  if(!composition)throw Error(`Missing ${id}`);
  if(mode==='qa'){
   const qa=path.join(dest,'qa',id);fs.mkdirSync(qa,{recursive:true});
   for(const frame of process.env.QA_FRAMES?process.env.QA_FRAMES.split(',').map(Number):[35,110,210,315,405,510,585,660,750,840,945]){
    await renderStill({serveUrl,composition,frame,output:path.join(qa,`${frame}.jpg`),imageFormat:'jpeg',jpegQuality:87,scale:.75,puppeteerInstance:browser});
    console.log(`QA ${id}: ${frame}`);
   }
  }else{
   let last=-1;
   const file=id==='Tidewake-PlayStore'?'Tidewake-Trailer-EN-1920x1080.mp4':'Tidewake-Trailer-EN-1080x1920.mp4';
   await renderStill({serveUrl,composition,frame:945,output:path.join(dest,file.replace('Trailer','Thumbnail').replace('.mp4','.jpg')),imageFormat:'jpeg',jpegQuality:95,puppeteerInstance:browser});
   await renderMedia({serveUrl,composition,outputLocation:path.join(dest,file),codec:'h264',audioCodec:'aac',crf:18,
    pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:94,concurrency:4,puppeteerInstance:browser,
    metadata:{title:'Tidewake: Island Survival — Official Gameplay Trailer',comment:'English. Real gameplay and original score. Produced with Remotion.'},
    onProgress:({progress})=>{const p=Math.floor(progress*10)*10;if(p!==last){console.log(`${id}: ${p}%`);last=p;}}
   });
   console.log(`Rendered ${file}`);
  }
 }
}finally{await browser.close({silent:true});}
