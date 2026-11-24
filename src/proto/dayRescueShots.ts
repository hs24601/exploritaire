import type { CombatAuthoredShot } from './combatDemoRig';
const shot = (id: string, name: string, position: CombatAuthoredShot['position'], target: CombatAuthoredShot['target'], durationMs = 1200): CombatAuthoredShot => ({ id: `rescue.${id}`, name, position, target, durationMs });
/** First pass: stay on one action axis; close reactions are directed toward Hero at (-3,0). */
export const DAY_TWO_RESCUE_SHOTS: Record<string, CombatAuthoredShot> = {
  mana: shot('mana','Small traveler beneath the woods',[-7,5,11],[-1.5,.8,0],1100),
  hope: shot('hope','A little hope / Hero close',[-5,2.8,6],[-3,1.05,0],1500),
  'slime-card': shot('threat','Threat enters her eyeline',[1,2.4,8],[-.5,1,0],700),
  cower: shot('cower','Stay at Hero’s height',[-5.4,1.9,5],[-3,.8,0],950),
  ambush: shot('ambush','Readable action on a shared axis',[-1,3.3,10],[-.5,.8,0],650),
  unconscious: shot('down','A small, still body',[-5,2.6,5],[-3,.25,0],900),
  'banks-card': shot('arrival','Make room for a protector',[-1,3.8,10],[-1,1,0],1100),
  banks: shot('banks','Banks between Hero and danger',[-5,3.4,8],[-1.7,1.1,0],1100),
  run: shot('run','Clear action wide / both actors',[-1,4.5,12],[0,1,0],1200),
  scratch: shot('scratch','Follow the strike',[0,3,10],[0,1,0],650),
  bite: shot('bite','Hold the action axis',[1,3.1,9],[.5,1,0],650),
  safe: shot('safe','Return attention to Hero',[-5,2.7,6],[-2.6,.6,.2],1400),
  approach: shot('approach','A gentle protective two-shot',[-5,2.7,6],[-2.6,.7,.2],1600),
  nuzzle: shot('nuzzle','Let the paired watercolor carry the touch',[-5,2.7,6],[-2.6,.7,.2],800),
  fade: shot('fade','Hold through the existing fade',[-5,2.7,6],[-2.6,.7,.2],800),
};
