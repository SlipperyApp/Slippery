import { Composition } from 'remotion';
import { Explainer } from './Explainer';
import { InAction, Bot, Importing, Social, Settling, LENGTHS } from './Films';
import { FPS, DURATION } from './theme';

/* TWO CUTS OF EVERY FILM, FROM ONE COMPONENT.
 *
 * The vertical is not a crop. Each component reads its own dimensions and
 * lays out for the shape it is in, so the phone cut stacks where the wide
 * cut sits side by side and no sentence loses its right-hand words.
 *
 * 1280x720 and 720x1280 rather than 1920x1080: these sit inside a column on
 * a marketing page, never full screen, and the file that arrives over a
 * phone connection is the one that matters.
 */
const FILMS = [
  ['InAction', InAction, LENGTHS.InAction],
  ['Bot', Bot, LENGTHS.Bot],
  ['Importing', Importing, LENGTHS.Importing],
  ['Social', Social, LENGTHS.Social],
  ['Settling', Settling, LENGTHS.Settling],
] as const;

export const Root: React.FC = () => (
  <>
    <Composition id="Explainer" component={Explainer} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="ExplainerVertical" component={Explainer} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
    {FILMS.map(([id, component, durationInFrames]) => (
      <Composition key={id} id={id} component={component}
        durationInFrames={durationInFrames} fps={FPS} width={1280} height={720} />
    ))}
    {FILMS.map(([id, component, durationInFrames]) => (
      <Composition key={id + 'V'} id={id + 'Vertical'} component={component}
        durationInFrames={durationInFrames} fps={FPS} width={720} height={1280} />
    ))}
  </>
);
