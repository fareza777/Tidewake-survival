import React from 'react';
import {AbsoluteFill,interpolate,staticFile,useCurrentFrame} from 'remotion';
import {Video} from '@remotion/media';
import {Brand,CutFlash,Grain,KeyArt,RevealText,clamp,ice,useLayout} from '../design';
export const Islands:React.FC=()=>{
 const frame=useCurrentFrame();const {fps,portrait}=useLayout();
 return <AbsoluteFill style={{background:'#06111c',overflow:'hidden'}}>
  <KeyArt opacity={.5}/><AbsoluteFill style={{background:'#04101b99'}}/>
  <div style={{position:'absolute',left:portrait?65:840,top:portrait?675:65,width:portrait?950:995,height:portrait?1100:950,display:'flex',gap:20,
    translate:interpolate(frame,[0,.45*fps],['0px 60px','0px 0px'],clamp)}}>
   <div style={{position:'relative',width:'50%',height:'100%',overflow:'hidden',outline:'1px solid #7de1ed66',borderRadius:5}}><Video src={staticFile('gameplay/frost.mp4')} premountFor={fps} muted loop objectFit="cover" style={{width:'100%',height:'100%'}}/><div style={{position:'absolute',bottom:0,padding:'60px 24px 29px',background:'linear-gradient(transparent,#04101b)',width:'100%',fontFamily:'Condensed',fontSize:portrait?48:44,color:ice,letterSpacing:2,textAlign:'center'}}>FROSTFANG</div></div>
   <div style={{position:'relative',width:'50%',height:'100%',overflow:'hidden',outline:'1px solid #ffad7666',borderRadius:5}}><Video src={staticFile('gameplay/ember.mp4')} premountFor={fps} muted loop objectFit="cover" style={{width:'100%',height:'100%'}}/><div style={{position:'absolute',bottom:0,padding:'60px 24px 29px',background:'linear-gradient(transparent,#04101b)',width:'100%',fontFamily:'Condensed',fontSize:portrait?48:44,color:'#ffad76',letterSpacing:2,textAlign:'center'}}>EMBERHOLD</div></div>
  </div>
  <Brand/>
  <div style={{position:'absolute',left:portrait?80:115,top:portrait?235:275,width:portrait?920:700}}>
   <div style={{fontFamily:'Barlow',fontSize:23,letterSpacing:5,color:ice,marginBottom:25}}>BEYOND THE HORIZON</div>
   <RevealText size={portrait?130:139}>FIVE ISLANDS.</RevealText>
   <RevealText delay={.12} color={ice} size={portrait?130:139}>{portrait?'NO SAFE SHORES.':'NO SAFE'}</RevealText>
   {!portrait&&<RevealText delay={.24} color={ice} size={139}>SHORES.</RevealText>}
   <div style={{fontFamily:'Barlow',fontSize:portrait?33:36,color:'#bdcdd3',marginTop:26,lineHeight:1.4}}>New lands. New dangers.</div>
  </div>
  <Grain/><CutFlash color={ice}/>
 </AbsoluteFill>;
};
