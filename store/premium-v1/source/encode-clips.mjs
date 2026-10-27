import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ffmpeg=process.env.FFMPEG||execFileSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
const frames=path.join(root,'captures','frames');
const dest=path.join(root,'remotion','public','gameplay');fs.mkdirSync(dest,{recursive:true});
const report=[];
for(const name of fs.readdirSync(frames)){
 if(process.env.CLIPSSELECT&&!process.env.CLIPSSELECT.split(',').includes(name))continue;
 const dir=path.join(frames,name);if(!fs.statSync(dir).isDirectory())continue;
 const count=fs.readdirSync(dir).filter(f=>f.endsWith('.jpg')).length;
 execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-framerate','30','-i',path.join(dir,'%05d.jpg'),'-vf','scale=720:1280:flags=lanczos','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart','-an',path.join(dest,`${name}.mp4`)],{stdio:'inherit'});
 report.push({name,frames:count,durationSeconds:count/30,width:720,height:1280});console.log(`Encoded ${name} (${count} frames)`);
}
fs.writeFileSync(path.join(root,'source','clip-report.json'),JSON.stringify(report,null,2));
