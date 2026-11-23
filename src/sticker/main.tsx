import { createRoot } from 'react-dom/client';
import { SnowflakeSticker, FlurryAmbiance } from './SnowflakeSticker';
import './snowflakePreview.css';

function SnowflakePreview() {
  return (
    <main className="snowflake-preview">
      <div className="snowflake-preview__stage"><FlurryAmbiance /><SnowflakeSticker /></div>
      <div className="snowflake-preview__copy">
        <h1>Flurry</h1>
        <p>Move your pointer or tilt your device to catch the foil.</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<SnowflakePreview />);
