import React from 'react';
import {AbsoluteFill,CanvasImage,interpolate,staticFile,useCurrentFrame} from 'remotion';
import {CutFlash,Embers,Grain,KeyArt,clamp,ease,gold,ice,useLayout} from '../design';
export const Outro:React.FC=()=>{
 const frame=useCurrentFrame();const {fps,portrait}=useLayout();
 return <AbsoluteFill style={{background:'#06111c',overflow:'hidden'}}>
  <KeyArt/><AbsoluteFill style={{background:portrait?'linear-gradient(#06111c55,#06111c00 35%,#06111c11 65%,#06111cdd)':'linear-gradient(90deg,#06111cbb,#06111c55 55%,#06111c00)'}}/>
  <div style={{position:'absolute',left:portrait?65:115,top:portrait?160:210,width:portrait?950:1160,textAlign:portrait?'center':'left',
   opacity:interpolate(frame,[0,.3*fps],[0,1],clamp),translate:interpolate(frame,[0,.55*fps],['0px 36px','0px 0px'],{...clamp,easing:ease})}}>
   <div style={{fontFamily:'Barlow',fontSize:portrait?25:24,letterSpacing:6,color:'#d6e1e2',marginBottom:30}}>YOUR NEXT LIFE STARTS HERE.</div>
   <div style={{fontFamily:'Cinzel',fontWeight:800,fontSize:portrait?142:181,letterSpacing:-5,lineHeight:1.1,color:'#f1d69c',textShadow:'0 5px 35px #0009'}}>TIDEWAKE</div>
   <div style={{fontFamily:'Barlow',fontSize:portrait?40:46,letterSpacing:portrait?13:16,color:'#e7edef',marginTop:5}}>ISLAND SURVIVAL</div>
   <div style={{height:2,width:portrait?650:700,margin:portrait?'36px auto':'40px 0',background:'linear-gradient(90deg,transparent,#e1bd7b,transparent)'}}/>
   <div style={{fontFamily:'Condensed',fontSize:portrait?63:70,color:ice,letterSpacing:1,opacity:interpolate(frame,[.7*fps,1.05*fps],[0,1],clamp)}}>PLAY OFFLINE. SURVIVE YOUR WAY.</div>
  </div>
  <div style={{position:'absolute',left:portrait?80:120,bottom:portrait?115:97,display:'flex',alignItems:'center',gap:25,
   opacity:interpolate(frame,[1*fps,1.4*fps],[0,1],clamp)}}>
   <CanvasImage src={staticFile('art/compass-icon-master.png')} premountFor={fps} style={{width:portrait?116:98,height:portrait?116:98,borderRadius:20}}/>
   <div><div style={{fontFamily:'Condensed',fontSize:portrait?55:48,color:gold,lineHeight:1}}>BEGIN YOUR SURVIVAL.</div><div style={{fontFamily:'Barlow',fontSize:portrait?24:22,color:'#bccfd7',letterSpacing:3,marginTop:12}}>A PIXEL-ART SURVIVAL RPG</div></div>
  </div>
  <Embers/><Grain/><CutFlash/>
 </AbsoluteFill>;
};
