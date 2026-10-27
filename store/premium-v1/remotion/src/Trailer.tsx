import React from 'react';
import {AbsoluteFill,Series,useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {staticFile} from 'remotion';
import {Hook} from './scenes/Hook';
import {Gather} from './scenes/Gather';
import {Camp} from './scenes/Camp';
import {Craft} from './scenes/Craft';
import {Islands} from './scenes/Islands';
import {Bosses} from './scenes/Bosses';
import {Progression} from './scenes/Progression';
import {Depths} from './scenes/Depths';
import {Story} from './scenes/Story';
import {Outro} from './scenes/Outro';

export const Trailer:React.FC=()=>{
 const {fps}=useVideoConfig();
 return <AbsoluteFill style={{background:'#06111c'}}>
  <Audio src={staticFile('audio/tidewake-original-score.wav')} premountFor={fps} volume={.92}/>
  <Series>
   <Series.Sequence name="01 — The island wants you dead" durationInFrames={2.5*fps} premountFor={fps}><Hook/></Series.Sequence>
   <Series.Sequence name="02 — Start with nothing" durationInFrames={3*fps} premountFor={fps}><Gather/></Series.Sequence>
   <Series.Sequence name="03 — Build before dark" durationInFrames={3.5*fps} premountFor={fps}><Camp/></Series.Sequence>
   <Series.Sequence name="04 — Turn scraps into survival" durationInFrames={3*fps} premountFor={fps}><Craft/></Series.Sequence>
   <Series.Sequence name="05 — Five islands, no safe shores" durationInFrames={4*fps} premountFor={fps}><Islands/></Series.Sequence>
   <Series.Sequence name="06 — Go below, hit back" durationInFrames={5*fps} premountFor={fps}><Bosses/></Series.Sequence>
   <Series.Sequence name="07 — Grow stronger, go further" durationInFrames={3*fps} premountFor={fps}><Progression/></Series.Sequence>
   <Series.Sequence name="08 — How far will you go" durationInFrames={3*fps} premountFor={fps}><Depths/></Series.Sequence>
   <Series.Sequence name="09 — Find your way home" durationInFrames={3*fps} premountFor={fps}><Story/></Series.Sequence>
   <Series.Sequence name="10 — Begin your survival" durationInFrames={4*fps} premountFor={fps}><Outro/></Series.Sequence>
  </Series>
 </AbsoluteFill>;
};
