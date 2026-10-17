import { useLayoutEffect, useState } from 'react';
import { setSceneActorExpression, useActorExpression } from '../actorExpression';

type Choice = 'story' | 'sad' | 'neutral' | 'curious' | 'happy' | 'joyful';
const storageKey = 'exploritaire.hero-scene-emotions.v1';
const readChoices = (): Record<string, Choice> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, choice]) =>
      ['day01', 'day02', 'day03', 'sandbox'].includes(key) && ['story', 'sad', 'neutral', 'curious', 'happy', 'joyful'].includes(choice)));
  } catch { return {}; }
};

/** Development composition settings, saved per scenario in this browser. */
export function SceneActorEmotion({ scenario, relieved = false }: { scenario: string; relieved?: boolean }) {
  const [choices, setChoices] = useState(readChoices);
  const [savedChoices, setSavedChoices] = useState(readChoices);
  const [saveError, setSaveError] = useState(false);
  const choice = choices[scenario] ?? 'story';
  const dirty = choice !== (savedChoices[scenario] ?? 'story');
  const resolved = useActorExpression('hero');
  const fallback = scenario === 'day01' ? 'happy' : scenario === 'day02' && !relieved ? 'sad' : 'neutral';
  useLayoutEffect(() => {
    setSceneActorExpression('hero', fallback, choice === 'story' ? undefined : choice);
    return () => setSceneActorExpression('hero');
  }, [fallback, choice, scenario]);
  const change = (value: Choice) => {
    const next = { ...choices, [scenario]: value };
    setChoices(next);
    setSaveError(false);
  };
  const save = () => {
    const next = { ...savedChoices, [scenario]: choice };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSavedChoices(next); setSaveError(false);
    } catch { setSaveError(true); }
  };
  return <div className="scenario-camera-details" data-camera-ignore="true">
    <div className="scene-actor-emotion-row"><label htmlFor="hero-scene-emotion">Hero emotion</label><select id="hero-scene-emotion" aria-label="Hero emotion" value={choice} onChange={event => change(event.target.value as Choice)}>
      <option value="story">Story default</option><option value="sad">Sad</option><option value="neutral">Neutral</option><option value="curious">Curious</option><option value="happy">Happy · cautious smile</option><option value="joyful">Joyful · open mouth</option>
    </select>
    <button type="button" aria-label="Save Hero emotion" onClick={save}>Save</button></div>
    <span role="status">{saveError ? 'Could not save in this browser. The preview is still active.' : dirty ? 'Unsaved preview' : 'Saved in this browser'}</span>
    <output aria-label="Resolved Hero emotion">Current: {resolved ?? fallback}</output>
    <span>Applies to this scenario. Sleeping and combat reactions keep their authored poses.</span>
  </div>;
}
