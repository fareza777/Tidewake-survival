import React from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Video} from '@remotion/media';
import {CutFlash,Embers,Grain,RevealText,clamp,gold,useLayout} from '../design';
export const Hook:React.FC=()=>{
 const frame=useCurrentFrame();const {fps,portrait}=useLayout();
 return <AbsoluteFill style={{background:'#030b13',overflow:'hidden'}}>
  <Video src={staticFile('gameplay/night.mp4')} premountFor={fps} muted loop objectFit="cover"
   style={{width:'100%',height:'100%',opacity:.53,filter:'brightness(.65)',scale:interpolate(frame,[0,2.5*fps],[1.05,1.2],{...clamp,output:'perceptual-scale'})}}/>
  <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 50%,#030b1340,#030b13e0)'}}/>
  <div style={{position:'absolute',left:portrait?80:118,right:portrait?80:118,top:portrait?510:210}}>
   <div style={{fontFamily:'Barlow',fontSize:portrait?27:25,letterSpacing:7,color:gold,marginBottom:28}}>ONE MORE SUNRISE.</div>
   <RevealText size={portrait?155:209}>THE ISLAND</RevealText>
   <RevealText size={portrait?155:209} delay={.12}>WANTS YOU</RevealText>
   <RevealText size={portrait?155:209} delay={.24} color="#ffb17b">DEAD.</RevealText>
  </div>
  <div style={{position:'absolute',left:portrait?80:125,bottom:portrait?245:100,fontFamily:'Barlow',fontSize:portrait?30:32,color:'#bdd2db',letterSpacing:3,
    opacity:interpolate(frame,[1.45*fps,1.65*fps],[0,1],clamp)}}>MAKE IT REGRET THAT.</div>
  <Embers/><Grain/><CutFlash/>
 </AbsoluteFill>;
};
