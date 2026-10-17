import { createRoot } from 'react-dom/client';
import { Callout } from '../src/proto/components/Callout';
import { CalloutEditingProvider } from '../src/proto/components/CalloutEditing';
createRoot(document.getElementById('root')!).render(<CalloutEditingProvider enabled><Callout authoringId="editor-preview" text="Keep this light for tomorrow." speaker="Hero" emoji={{actor:'hero',emotion:'happy'}} anchor={{x:180,y:300}} durationMs={0}/></CalloutEditingProvider>);
