import { BALANCE, connected, currentNode, nextNodes, type CombatNode, type Run } from './sceneRun';

const positions=(node:CombatNode) => ({x:8+(node.stage-1)*21+(node.stage===1?0:((node.row*13+node.stage*7)%5-2)*1.1),y:node.stage===1?50:15+node.row*23});
/** A branching combat itinerary, with native buttons over the constellation. */
export function CombatNodeMap({run,selectable,onChoose}:{run:Run;selectable:boolean;onChoose:(id:string)=>void}) {
 const current=currentNode(run),eligible=nextNodes(run),visited=new Set(run.visited);
 const edges=run.nodes.flatMap(a=>run.nodes.filter(b=>connected(a,b)).map(b=>({a,b})));
 const path=run.visited.includes(run.nodeId)?run.visited:[...run.visited,run.nodeId];
 return <section className="combat-path" aria-label="Combat path">
  <div className="combat-path__heading"><h1>{selectable?'Choose the next fight':'Your combat path'}</h1><p>{run.completed}/5 cleared · {run.hp}/{run.maxHp} HP{selectable?` · victory restores ${BALANCE.recovery} HP`:''}</p></div>
  <div className="combat-path__chart">
   <svg className="combat-path__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map(({a,b})=>{
    const p=positions(a),q=positions(b),done=path.some((id,i)=>id===a.id&&path[i+1]===b.id),open=a.id===current.id&&eligible.some(n=>n.id===b.id);
    return <line key={a.id+b.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} data-traversed={done||undefined} data-eligible={open||undefined}/>;
   })}</svg>
   <svg className="combat-path__links combat-path__links--portrait" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map(({a,b})=>{
    const p=positions(a),q=positions(b),done=path.some((id,i)=>id===a.id&&path[i+1]===b.id),open=a.id===current.id&&eligible.some(n=>n.id===b.id);
    return <line key={a.id+b.id} x1={p.y} y1={p.x} x2={q.y} y2={q.x} data-traversed={done||undefined} data-eligible={open||undefined}/>;
   })}</svg>
   {run.nodes.map(node=>{
    const p=positions(node),here=node.id===current.id,done=visited.has(node.id),open=eligible.some(n=>n.id===node.id),canChoose=selectable&&open;
    return <button type="button" key={node.id} className="combat-path__node" style={{'--node-x':`${p.x}%`,'--node-y':`${p.y}%`} as React.CSSProperties} data-node={node.id} data-current={here||undefined} data-visited={done||undefined} data-eligible={open||undefined} data-last={node.stage===5||undefined} disabled={!canChoose} aria-current={here?'step':undefined} aria-label={`${here?'Current · ':done?'Cleared · ':canChoose?'Choose · ':'Future · '}${node.name} · fight ${node.stage}. ${node.risk}. Reward: ${node.hint}`} onClick={()=>onChoose(node.id)}>
     <span className="combat-path__point" aria-hidden="true">{done?node.stage:here?'◉':open?String.fromCharCode(65+node.row):''}</span>
     {open&&<span className="combat-path__label"><strong>{node.name}</strong><span>{node.risk}</span><span>{node.hint}</span></span>}
    </button>;
   })}
  </div>
  <nav className="combat-path__choices" aria-label="Next combat options">{eligible.map(node=><button type="button" key={node.id} data-option={node.id} disabled={!selectable} onClick={()=>onChoose(node.id)}><span>{String.fromCharCode(65+node.row)}</span><span><strong>{node.name} · {node.foes} Mote{node.foes===2?'s':''}</strong><span>{node.hp} HP each · {node.hint}</span></span></button>)}</nav>
  <p className="combat-path__legend"><span>● Cleared</span><span>◉ Current</span><span>◎ Available next</span></p>
 </section>;
}
