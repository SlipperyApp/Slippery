import { SlipFlowProvider } from '@/components/app/SlipFlow';

/** The import is four screens and one slip.
 *
 *  The provider sits on the layout rather than on any page, because a layout
 *  survives navigation between the pages under it and a page does not. Before
 *  this, the file chosen on the first screen reached nothing: the crop step
 *  drew a placeholder, the analysing step ran a timer, and the review screen
 *  showed a worked example whatever anybody uploaded. */
export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return <SlipFlowProvider>{children}</SlipFlowProvider>;
}
