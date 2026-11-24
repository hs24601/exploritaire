export type GridPathCard={index:number;id:string;rank:number};
export function adjacentGridCells(a:number,b:number,columns:number){const dr=Math.abs(Math.floor(a/columns)-Math.floor(b/columns)),dc=Math.abs(a%columns-b%columns);return a!==b&&dr<=1&&dc<=1;}
export function legalGridRanks(a:number,b:number){const d=Math.abs(a-b);return d===1||d===12;}
/** Preview is reversible and side-effect free; only release queues actual receipts. */
export function extendGridPath(path:GridPathCard[],next:GridPathCard,columns:number):GridPathCard[]{
 const last=path[path.length-1];if(!last)return [next];if(last.index===next.index)return path;
 if(path.length>1&&path[path.length-2].index===next.index)return path.slice(0,-1);
 if(path.some(card=>card.index===next.index)||!adjacentGridCells(last.index,next.index,columns)||!legalGridRanks(last.rank,next.rank))return path;
 return [...path,next];
}
export function currentGridPath(path:GridPathCard[],lookup:(index:number)=>GridPathCard|undefined,columns:number){
 return path.length>0&&path.every((card,i)=>{const latest=lookup(card.index);return latest?.id===card.id&&latest.rank===card.rank&&(i===0||adjacentGridCells(path[i-1].index,card.index,columns)&&legalGridRanks(path[i-1].rank,card.rank));});
}
