import { useId } from 'react';
import { LIGHT_MOTES, type LightMoteId } from '../rules/lightMoteData';

/** Code-native mote art, shared by the reward card and its compact emblem. */
export function MoteOrb({ id }: { id: LightMoteId }) {
 const uid=useId().replace(/:/g,''),mote=LIGHT_MOTES[id];
 return <svg className="light-mote-art" viewBox="0 0 240 280" role="img" aria-label={mote.name} style={{color:mote.color}}>
  <defs><radialGradient id={uid+'core'} cx="35%" cy="30%"><stop stopColor="#fff5d9" stopOpacity=".85"/><stop offset=".22" stopColor="currentColor"/><stop offset=".75" stopColor="currentColor" stopOpacity=".35"/><stop offset="1" stopColor="#11171c"/></radialGradient><radialGradient id={uid+'aura'}><stop stopColor="currentColor" stopOpacity=".35"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></radialGradient></defs>
  <circle cx="120" cy="145" r="108" fill={`url(#${uid}aura)`}/><path d="M42 161 Q28 83 102 66 Q184 43 199 128 Q218 202 147 218 Q70 237 42 161Z" fill={`url(#${uid}core)`} stroke="currentColor" strokeOpacity=".65"/>
  <path d="M63 119 Q70 81 101 80 M167 184 Q180 172 182 149" fill="none" stroke="#fff5da" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round"/>
  <text x="120" y="165" textAnchor="middle" fill="#fff4dc" fontSize="57" fontFamily="Georgia,serif">{mote.glyph}</text>
  <g fill="currentColor"><circle cx="39" cy="59" r="2"/><circle cx="193" cy="59" r="3"/><circle cx="214" cy="194" r="2"/><circle cx="66" cy="237" r="2"/><circle cx="21" cy="132" r="1.5"/></g>
 </svg>;
}
