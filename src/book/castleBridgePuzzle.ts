import {CASTLE,clearsCastleMasonry,resolveMove} from './castleLayout';
import {groundsHeight,groundsWalkable} from './castleGroundsLayout';
import type {PlatformSurface} from './castlePlatformMotion';

export const BRIDGE_SEEDS=[2,1,2,1] as const;
export const PLANK_PACKS=[
  {x:-12,z:60.5,ranks:[1,2,3,2]},
  {x:-8.8,z:62.5,ranks:[2,3,2,1]},
  {x:11.8,z:60.5,ranks:[3,2,1,2]},
] as const;
export const BRIDGE_COLUMNS=4,BRIDGE_ROWS=4;
/** Physical geometry, textures and hit targets all share the game's 63:88 face. */
export const BRIDGE_CARD_HEIGHT=5.65,BRIDGE_CARD_WIDTH=BRIDGE_CARD_HEIGHT*63/88;
export const BRIDGE_CARD_PITCH=BRIDGE_CARD_WIDTH+.18;
export const BRIDGE_HALF_WIDTH=BRIDGE_CARD_PITCH*2;
export const bridgeCell=(index:number)=>({x:(index%4-1.5)*BRIDGE_CARD_PITCH,z:58.5-Math.floor(index/4)*6});
export type PlankCard={id:string;rank:number};

/** Spatial golf: every occupied orthogonal neighbour must be one rank away.
 * Cards connect to the bank through existing cards; diagonals never support a play. */
export class CastleBridgePuzzle {
  readonly board:(PlankCard|undefined)[]=Array.from({length:16},(_,i)=>i<4?{id:`seed-${i}`,rank:BRIDGE_SEEDS[i]}:undefined);
  readonly collected=new Set<number>();
  readonly history:{slot:number;card:PlankCard}[]=[];
  get complete(){return this.board.every(Boolean);}
  /** Seed row anchors the puzzle; each complete additional row builds a third. */
  get builtSections(){for(let row=1;row<4;row++)for(let col=0;col<4;col++)if(!this.board[row*4+col])return row-1;return 3;}
  get builtEdge(){return 60-25*this.builtSections/3;}
  get inventory(){return PLANK_PACKS.flatMap((pack,p)=>this.collected.has(p)?pack.ranks.map((rank,i)=>({id:`${p}-${i}`,rank})):[]).filter(card=>!this.board.some(placed=>placed?.id===card.id));}
  get filled(){return this.board.filter(Boolean).length;}
  collect(pack:number){if(!PLANK_PACKS[pack]||this.collected.has(pack))return false;this.collected.add(pack);return true;}
  neighbours(slot:number){const row=Math.floor(slot/4),col=slot%4;return [row>0?slot-4:-1,row<3?slot+4:-1,col>0?slot-1:-1,col<3?slot+1:-1].filter(i=>i>=0);}
  canPlace(slot:number,rank:number){
    if(!Number.isInteger(slot)||slot<4||slot>=16||this.board[slot]||this.complete)return false;
    const touching=this.neighbours(slot).map(i=>this.board[i]).filter((c):c is PlankCard=>!!c);
    return touching.length>0&&touching.every(card=>Math.abs(card.rank-rank)===1);
  }
  place(slot:number,id:string){const card=this.inventory.find(card=>card.id===id);if(!card||!this.canPlace(slot,card.rank))return false;this.board[slot]=card;this.history.push({slot,card});return true;}
  undo(){if(this.complete)return false;const last=this.history.pop();if(!last)return false;this.board[last.slot]=undefined;return true;}
  /** Gate the whole island until the blueprint is finished. This also closes
   * alternate landing/teleport routes and cannot be bypassed by a triple jump. */
  private onDeck=(x:number,z:number,radius=0)=>Math.abs(x)<BRIDGE_HALF_WIDTH-radius&&z>35+radius&&z<60-radius;
  height=(x:number,z:number)=>this.onDeck(x,z)?.25:groundsHeight(x,z);
  walkable=(x:number,z:number,radius:number=CASTLE.heroRadius)=>{
    const dry=groundsWalkable(x,z,radius)||this.onDeck(x,z,radius)&&clearsCastleMasonry(x,z,radius);
    return dry&&(this.complete||Math.hypot(x,z)>58+radius||this.builtSections>0&&this.onDeck(x,z,radius)&&z>=this.builtEdge+radius);
  };
  readonly surface:PlatformSurface={height:this.height,wall:(x,z)=>!clearsCastleMasonry(x,z,CASTLE.heroRadius),move:(x,z,dx,dz)=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(CASTLE.heroRadius*.5)));
    for(let i=0;i<steps;i++)({x,z}=resolveMove(x,z,dx/steps,dz/steps,this.walkable));
    return {x,z};
  }};
}
