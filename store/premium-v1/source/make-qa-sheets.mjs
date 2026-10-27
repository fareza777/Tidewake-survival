import {chromium} from 'playwright-core';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({channel:'msedge',headless:true});
for(const [name,w,h] of [['Tidewake-PlayStore',2400,1190],['Tidewake-Vertical',1600,2190]]){
 const dir=path.join(root,'video','qa',name);
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.jpg')).sort((a,b)=>parseInt(a)-parseInt(b));
 const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
 await page.setContent(`<html><style>*{box-sizing:border-box}body{margin:0;background:#06111c;color:#d1bb89;font:22px Arial;padding:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}img{width:100%;display:block}p{margin:8px 0 20px}</style><body><p>${name} / FRAME CHECKS</p><div class="grid">${files.map(f=>`<div><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir,f)).toString('base64')}"><p>${f.replace('.jpg','')} / ${(parseInt(f)/30).toFixed(2)}s</p></div>`).join('')}</div></body></html>`);
 await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
 await page.screenshot({path:path.join(root,'video','qa',`${name}-contact.jpg`),type:'jpeg',quality:90});
 await page.close();
}
await browser.close();
