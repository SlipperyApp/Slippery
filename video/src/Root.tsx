import { Composition } from 'remotion';
import { Explainer } from './Explainer';
import { FPS, DURATION } from './theme';

/* Two compositions from one component. The vertical cut is not a crop: the
   component reads its own dimensions and lays out for the shape it is in,
   so the 9:16 version stacks where the 16:9 version sits side by side. */
export const Root: React.FC = () => (
  <>
    <Composition
      id="Explainer"
      component={Explainer}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="ExplainerVertical"
      component={Explainer}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
