import { useSyncExternalStore } from 'react';
import type { HeroEmojiEmotion } from './heroEmojis';
export type ActorExpression = HeroEmojiEmotion | 'neutral' | 'curious';

// Callouts publish their resolved expression, after browser-local edits. Owners
// release only their own lease, so an old bubble cannot clear a newer speaker.
const expressions = new Map<symbol, { actor: string; emotion: ActorExpression }>();
const scenes = new Map<string, { fallback?: ActorExpression; override?: ActorExpression }>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export function claimActorExpression(actor: string, emotion: ActorExpression) {
  const owner = Symbol(actor);
  expressions.set(owner, { actor, emotion }); emit();
  return () => { expressions.delete(owner); emit(); };
}
export function getActorExpression(actor: string): ActorExpression | undefined {
  const scene = scenes.get(actor);
  return scene?.override ?? [...expressions.values()].reverse().find(entry => entry.actor === actor)?.emotion ?? scene?.fallback;
}
/** Scene mood survives dialogue dismissal; explicit composition wins over dialogue. */
export function setSceneActorExpression(actor: string, fallback?: ActorExpression, override?: ActorExpression) {
  const previous = scenes.get(actor);
  if (previous?.fallback === fallback && previous?.override === override) return;
  if (fallback === undefined && override === undefined) scenes.delete(actor);
  else scenes.set(actor, { fallback, override });
  emit();
}
export function useActorExpression(actor: string) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => getActorExpression(actor), () => undefined);
}
