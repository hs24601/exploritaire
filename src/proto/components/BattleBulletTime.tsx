import './BattleBulletTime.css';

/** A fixed particle budget; CSS moves only transform/opacity, with no simulation loop. */
export function BattleBulletTime() {
  return <div className="battle-bullet-time" aria-hidden="true">
    {Array.from({length:12},(_,index)=><i key={index} style={{left:`${8+(index*29)%84}%`,top:`${12+(index*37)%72}%`,animationDelay:`${-index*2.7}s`}} />)}
    <span>Bullet time · 10% speed</span>
  </div>;
}
