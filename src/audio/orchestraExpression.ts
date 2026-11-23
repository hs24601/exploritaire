/** Musical phrasing is separate from note triggering: card feedback stays immediate. */
export function constellationPhrase(degrees:readonly number[],step=60/72/2){
 let at=0;
 return degrees.map((degree,index)=>{
  const final=index===degrees.length-1,breathe=index>0&&index%4===0;
  if(breathe)at+=step*.22;
  const previous=degrees[index-1],leap=previous===undefined?0:Math.abs(degree-previous),stress=index%4===0;
  const length=final?step*2.8:step*(leap>3?.68:.86),gain=final?.19:(stress?.165:.135)*(1+.08*Math.sin(index*1.9));
  const note={degree,at,length,gain,expression:final?.72:stress?.88:.76,attack:final?.05:leap>3?.025:.014,release:final?.4:.12};
  at+=step*(final?1:index%4===2?1.1:index%4===3?1.06:.96);return note;
 });
}

/** Quiet voice-leading instead of replaying every chord in root position. */
export function leadChord(notes:readonly number[],previous:readonly number[]=[]){
 return notes.map((note,i)=>{const target=previous[i]??note;return [note-12,note,note+12].filter(n=>n>=45&&n<=76).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0]??note;}).sort((a,b)=>a-b);
}
