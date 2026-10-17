import { gameTime } from '../gameTime';
import {useEffect,useRef,useState} from 'react';
export type CinemaBeat = {id:string;durationMs?:number;dialogue?:string;speaker?:'Hero'|'Banks';emotion?:'sad'|'upset'|'joyful'|'stars';cue?:string};
/** Authored beats own timing; pause, hidden tabs and reading never advance the clock. */
export function useCinema(beats:readonly CinemaBeat[],onCue:(cue:string)=>void,onComplete:()=>void){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false);const remaining=useRef<number|null>(null);
 const cue=useRef(onCue),complete=useRef(onComplete);cue.current=onCue;complete.current=onComplete;
 const beat=beats[index];
 useEffect(()=>{remaining.current=beat?.durationMs??null;if(beat?.cue)cue.current(beat.cue);if(!beat)complete.current();},[index,beats]);
 useEffect(()=>{if(!beat?.durationMs||paused)return;let previous=gameTime.now();const timer=gameTime.setInterval(()=>{const now=gameTime.now();if(!document.hidden){remaining.current=Math.max(0,(remaining.current??beat.durationMs!)-(now-previous));if(remaining.current===0)setIndex(i=>i===index?i+1:i);}previous=now;},50);return()=>gameTime.clearInterval(timer);},[index,paused,beat]);
 return {beat,index,paused,setPaused,next:()=>{if(!paused)setIndex(i=>Math.min(beats.length,i+1));}};
}
export const BANKS_RESCUE_BEATS:readonly CinemaBeat[]=[
 {id:'mana',durationMs:1300,cue:'reveal'},
 {id:'hope',speaker:'Hero',emotion:'joyful',dialogue:'Manaberries! There are still some here.'},
 {id:'slime-card',durationMs:1500,cue:'slime'},
 {id:'cower',speaker:'Hero',emotion:'upset',dialogue:'Oh! Please... I only need a little food.',cue:'cower'},
 {id:'ambush',durationMs:1700,cue:'hit'},
 {id:'unconscious',durationMs:1300},
 {id:'banks-card',durationMs:1600,cue:'banks'},
 {id:'banks',speaker:'Banks',emotion:'upset',dialogue:'Step away from her.',cue:'spawn-banks'},
 {id:'run',cue:'solve'},
 {id:'scratch',durationMs:1050,cue:'scratch'},
 {id:'bite',durationMs:1400,cue:'bite'},
 {id:'safe',speaker:'Banks',emotion:'sad',dialogue:'Easy, little one. You are safe now.'},
 {id:'approach',durationMs:2200,cue:'approach'},
 {id:'nuzzle',durationMs:3200,cue:'nuzzle'},
 {id:'fade',durationMs:1600,cue:'fade'},
];
