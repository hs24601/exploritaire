import { createRoot } from 'react-dom/client';
import { Callout } from '../src/proto/components/Callout';
import { useCallouts } from '../src/proto/hooks/useCallouts';

function Preview() {
  const { callouts, show, dismiss, clear } = useCallouts();
  return <main style={{ background: '#20252e', color: '#fff3dd', minHeight: '100vh', padding: 20, boxSizing: 'border-box', fontFamily: 'system-ui' }}>
    <h1>Proto Callout</h1>
    <button onClick={() => show({ speaker: 'Hero', text: 'A little light will help us find the way home.',
      emoji: { actor: 'hero', emotion: 'happy' }, anchor: () => ({ x: innerWidth / 2, y: innerHeight * .7 + Math.sin(performance.now() / 1000) * 60 }) })}>Speak (5 seconds)</button>
    <button onClick={clear}>Clear</button>
    <Callout speaker="Mochi" text="A longer line wraps inside the bubble, even on a narrow screen." emoji={{ actor: 'mochi', emotion: 'happy' }} anchor={{ x: 12, y: 10 }} durationMs={0} />
    <Callout speaker="Banks" text="Ready." emoji={{ actor: 'banks', emotion: 'happy' }} anchor={{ x: innerWidth - 12, y: innerHeight - 12 }} durationMs={0} tone="gold" />
    {callouts.map(({ id, ...message }) => <Callout key={id} instanceKey={id} {...message} onDismiss={() => dismiss(id)} />)}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
