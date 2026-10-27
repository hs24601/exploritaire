import { ProtoVariant } from '../proto/ProtoVariant';
import { CardJumboProvider } from '../proto/components/CardJumbo';
import { GameTooltip } from '../proto/components/GameTooltip';
import { MediaReady } from '../proto/components/MediaReady';
import './ProtoTooling.css';

/** The tooling entry point owns only authoring for the current Proto platform. */
export function ToolingApp() {
  return <><GameTooltip /><MediaReady><CardJumboProvider><ProtoVariant authoring /></CardJumboProvider></MediaReady></>;
}
