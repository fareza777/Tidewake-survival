import React from 'react';
import {Sequence,useVideoConfig} from 'remotion';
import {GameplayScene} from './GameplayScene';
export const Bosses:React.FC=()=>{
 const {fps}=useVideoConfig();
 return <>
  <Sequence name="Forgeheart encounter" durationInFrames={2.5*fps} premountFor={fps}><GameplayScene clip="magmaforge" line1="GO BELOW." line2="HIT BACK." label="DUNGEONS. TRAPS. BOSSES." detail="The deeper you go, the harder they hit." accent="#ffad76"/></Sequence>
  <Sequence name="Glacier King encounter" from={2.5*fps} durationInFrames={2.5*fps} premountFor={fps}><GameplayScene clip="frostcave" line1="BIG BOSSES." line2="BIGGER NERVE." label="EARN YOUR NEXT VICTORY." detail="Fight for rare gear and the way forward." accent="#a9e8ff"/></Sequence>
 </>;
};
