import React from 'react';
import {AbsoluteFill, CanvasImage, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

Promise.all([
  loadFont({family:'Cinzel',url:staticFile('fonts/Cinzel.ttf'),weight:'100 900'}),
  loadFont({family:'Condensed',url:staticFile('fonts/BarlowCondensed-Bold.ttf'),weight:'700'}),
  loadFont({family:'Barlow',url:staticFile('fonts/Barlow-Medium.ttf'),weight:'500'}),
]);
export const gold='#f0cd88';
export const ice='#7de1ed';
export const cream='#f6f0df';
export const ease=Easing.bezier(.16,1,.3,1);
export const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
export const useLayout=()=>{const c=useVideoConfig();return {...c,portrait:c.height>c.width};};

export const Grain:React.FC=()=>{
  const frame=useCurrentFrame();
  const id=React.useId().replace(/:/g,'');
  return <AbsoluteFill style={{pointerEvents:'none',opacity:.035,overflow:'hidden'}}>
    <svg width="110%" height="110%" style={{translate:`${-(frame%4)*13}px ${-(frame%3)*11}px`}}>
      <defs><filter id={id}><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves={3} stitchTiles="stitch"/></filter></defs>
      <rect width="100%" height="100%" opacity=".5" filter={`url(#${id})`}/>
    </svg>
  </AbsoluteFill>;
};
export const Embers:React.FC<{intensity?:number}>=({intensity=1})=>{
  const frame=useCurrentFrame();const {width,height,fps}=useVideoConfig();
  return <AbsoluteFill style={{pointerEvents:'none',overflow:'hidden'}}>{Array.from({length:26},(_,i)=>{
    const phase=((frame/fps*(.11+(i%5)*.017)+i*.137)%1);
    return <div key={i} style={{position:'absolute',left:((i*157)%997)/997*width,top:height*(1-phase),width:i%3===0?4:2,height:i%3===0?8:4,background:i%3===0?'#f6cd89':'#ff8b43',opacity:Math.sin(phase*Math.PI)*.55*intensity,rotate:`${phase*120}deg`,translate:`${Math.sin(phase*8+i)*22}px 0`,boxShadow:'0 0 12px #ff8d5260'}}/>;
  })}</AbsoluteFill>;
};
export const Brand:React.FC<{color?:string}>=({color=gold})=>{
  const {portrait}=useLayout();
  return <div style={{position:'absolute',left:portrait?80:115,top:portrait?73:64,fontFamily:'Cinzel',fontSize:portrait?30:28,fontWeight:700,letterSpacing:6,color}}>TIDEWAKE<span style={{display:'block',fontFamily:'Barlow',fontSize:portrait?16:13,color:'#b0c7cf',letterSpacing:4,marginTop:6}}>ISLAND SURVIVAL</span></div>;
};
export const RevealText:React.FC<{children:React.ReactNode;delay?:number;color?:string;size?:number}>=({children,delay=0,color=cream,size})=>{
  const frame=useCurrentFrame();const {fps,portrait}=useLayout();
  return <div style={{overflow:'hidden',paddingBottom:8}}><div style={{fontFamily:'Condensed',fontWeight:700,fontSize:size||(portrait?116:151),lineHeight:.92,letterSpacing:-1.5,color,
    translate:interpolate(frame,[delay*fps,(delay+.38)*fps],['0px 110%','0px 0%'],{...clamp,easing:ease}),
    opacity:interpolate(frame,[delay*fps,(delay+.12)*fps],[0,1],clamp)}}>{children}</div></div>;
};
export const KeyArt:React.FC<{opacity?:number;portraitArt?:boolean}>=({opacity=1,portraitArt})=>{
  const frame=useCurrentFrame();const {portrait,durationInFrames,fps}=useLayout();
  return <CanvasImage src={staticFile(`art/archipelago-keyart-${(portraitArt??portrait)?'portrait':'wide'}.png`)} premountFor={fps}
    style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity,
      scale:interpolate(frame,[0,durationInFrames],[1.05,1.14],{...clamp,output:'perceptual-scale'}),
      translate:interpolate(frame,[0,durationInFrames],['0px 0px','-12px -8px'],clamp)}}/>;
};
export const CutFlash:React.FC<{color?:string}>=({color=gold})=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:color,opacity:interpolate(frame,[0,3,8],[.24,.08,0],clamp),pointerEvents:'none'}}/>;
};
