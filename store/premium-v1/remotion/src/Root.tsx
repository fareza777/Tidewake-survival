import {Composition,Folder} from 'remotion';
import {Trailer} from './Trailer';
import {Hook} from './scenes/Hook';
import {Camp} from './scenes/Camp';
import {Islands} from './scenes/Islands';
import {Bosses} from './scenes/Bosses';
import {Outro} from './scenes/Outro';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Tidewake-PlayStore" component={Trailer} width={1920} height={1080} fps={30} durationInFrames={1020}/>
      <Composition id="Tidewake-Vertical" component={Trailer} width={1080} height={1920} fps={30} durationInFrames={1020}/>
      <Folder name="Scenes">
        <Composition id="Hook" component={Hook} width={1920} height={1080} fps={30} durationInFrames={75}/>
        <Composition id="Build" component={Camp} width={1920} height={1080} fps={30} durationInFrames={105}/>
        <Composition id="Archipelago" component={Islands} width={1920} height={1080} fps={30} durationInFrames={120}/>
        <Composition id="Bosses" component={Bosses} width={1920} height={1080} fps={30} durationInFrames={150}/>
        <Composition id="EndCard" component={Outro} width={1920} height={1080} fps={30} durationInFrames={120}/>
      </Folder>
    </>
  );
};
