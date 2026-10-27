import React from 'react';
import {AbsoluteFill, CanvasImage, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Video} from '@remotion/media';
import {Brand,CutFlash,Embers,Grain,KeyArt,RevealText,clamp,ease,gold,useLayout} from '../design';

type Props={clip:string;line1:string;line2:string;label:string;detail:string;accent?:string;crop?:boolean;layout?:'craft'|'gear'};
export const GameplayScene:React.FC<Props>=({clip,line1,line2,label,detail,accent=gold,crop=false,layout})=>{
 const frame=useCurrentFrame();const {portrait,fps,durationInFrames}=useLayout();
 return <AbsoluteFill style={{background:'#06111c',overflow:'hidden'}}>
  <KeyArt opacity={.55}/>
  <AbsoluteFill style={{background:portrait?'linear-gradient(#04101be8 0%,#04101bd9 23%,#04101b44 52%,#04101bd9 100%)':'linear-gradient(90deg,#04101bf2 0%,#04101bec 45%,#04101b66 80%,#04101b88 100%)'}}/>
  <div style={{position:'absolute',left:portrait?180:1112,top:portrait?535:61,width:portrait?720:540,height:portrait?1280:960,overflow:'hidden',borderRadius:6,outline:`1px solid ${accent}66`,boxShadow:'0 35px 100px #0009',
    translate:interpolate(frame,[0,.5*fps],[portrait?'0px 80px':'100px 0px','0px 0px'],{...clamp,easing:ease}),opacity:interpolate(frame,[0,.3*fps],[.5,1],clamp)}}>
    <div style={{position:'absolute',inset:0,overflow:'hidden',height:layout?(layout==='gear'?'52%':'64%'):'100%'}}>
      <Video src={staticFile(`gameplay/${clip}.mp4`)} premountFor={fps} muted loop objectFit={crop?'cover':'contain'}
        style={{width:'100%',height:portrait?1280:960,background:'#07111a',scale:interpolate(frame,[0,durationInFrames],[1,1.025],{...clamp,output:'perceptual-scale'})}}/>
    </div>
    {layout&&<div style={{position:'absolute',left:0,right:0,top:layout==='gear'?'55%':'67%',bottom:0,overflow:'hidden',borderTop:`2px solid ${accent}99`,background:'#07111a'}}>
      {layout==='gear'?<CanvasImage src={staticFile('gameplay/skills.png')} premountFor={fps}
        style={{position:'absolute',top:portrait?-146:-110,width:'100%',height:'auto',translate:interpolate(frame,[0,durationInFrames],['0px 0px','0px -175px'],clamp)}}/>:
        <Video src={staticFile('gameplay/gather.mp4')} premountFor={fps} muted loop objectFit="cover" style={{width:'100%',height:'100%'}}/>}
    </div>}
  </div>
  <Brand/>
  <div style={{position:'absolute',left:portrait?80:118,top:portrait?172:278,width:portrait?920:950}}>
   <div style={{fontFamily:'Barlow',fontSize:portrait?24:23,color:accent,letterSpacing:5,marginBottom:portrait?20:33,
     opacity:interpolate(frame,[0,.2*fps],[0,1],clamp)}}>{label}</div>
   <RevealText size={portrait?109:149}>{line1}</RevealText>
   <RevealText delay={.12} color={accent} size={portrait?109:149}>{line2}</RevealText>
   <div style={{marginTop:portrait?17:33,fontFamily:'Barlow',fontSize:portrait?31:38,lineHeight:1.35,color:'#bdcdd3',maxWidth:portrait?920:815,
     opacity:interpolate(frame,[.4*fps,.65*fps],[0,1],clamp),translate:interpolate(frame,[.4*fps,.8*fps],['0px 18px','0px 0px'],{...clamp,easing:ease})}}>{detail}</div>
  </div>
  {!portrait&&<div style={{position:'absolute',left:120,bottom:94,fontFamily:'Barlow',fontSize:17,letterSpacing:4,color:'#9baeb6'}}>REAL GAMEPLAY <span style={{margin:'0 17px',color:accent}}>•</span> YOUR NEXT SUNRISE IS EARNED.</div>}
  {portrait&&<div style={{position:'absolute',bottom:54,left:80,fontFamily:'Barlow',fontSize:20,letterSpacing:4,color:'#aabfc9'}}>REAL GAMEPLAY <span style={{color:accent,marginLeft:25}}>SURVIVE YOUR WAY.</span></div>}
  <Embers intensity={.45}/><Grain/><CutFlash color={accent}/>
 </AbsoluteFill>;
};
