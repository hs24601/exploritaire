// Run: node tools/split-card-montecarlo.mjs [trials=5000]
// Uses production deal/pair generation. This is a receipt-flow study, not a combat-win model.
import ts from 'typescript';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
// Extract the two pure stock functions to avoid initializing unrelated browser modules.
const source=readFileSync('src/proto/rules/skirmish.ts','utf8');
const stockSource=source.match(/const roll = [\s\S]*?\n};/)[0]+'\n'+source.match(/export const stockCard = [^\n]+/)[0];
const pureSource=stockSource+'\n'+readFileSync('src/proto/rules/splitCards.ts','utf8').replace(/^import type[^\n]*\n/m,'');
const compiled=ts.transpileModule(pureSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {stockCard,splitCard,cardRanks,validSplitPair}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const trials=Number(process.argv[2]||5000), cap=100;
const adjacent=(a,b)=>[1,12].includes(Math.abs(a-b));
const options=(columns,ranks)=>{
 const out=[];
 for(let c=0;c<columns.length;c++){if(!columns[c].length)continue;for(let f=0;f<ranks.length;f++)for(const rank of cardRanks(columns[c].at(-1)))if(adjacent(rank,ranks[f]))out.push({c,f,rank});}
 return out;
};
// Search only visible cards; never peek at the stock. Depth-three search maximizes
// visible continuation length, then number of next legal rank/target outcomes.
function score(columns,ranks,depth){
 const moves=options(columns,ranks);if(!moves.length)return 0;
 if(depth===0)return moves.length/1000;
 let best=0;
 for(const m of moves){const next=columns.map((col,c)=>c===m.c?col.slice(0,-1):col);const fs=ranks.slice();fs[m.f]=m.rank;
  const s=1+score(next,fs,depth-1);if(s>best)best=s;
 }
 return best;
}
// Empty virtual columns are permitted when a visible search exhausts a stack;
// options skips them without estimating unseen cards.
function choose(columns,ranks,moves,policy,rng){
 if(policy==='random')return moves[Math.floor(rng()*moves.length)];
 let best=-1,chosen=moves[0];
 for(const m of moves){const next=columns.map((col,c)=>c===m.c?col.slice(0,-1):col);const fs=ranks.slice();fs[m.f]=m.rank;
  const s=score(next,fs,2);if(s>best){best=s;chosen=m;}
 }return chosen;
}
const cases=[{name:'single 6C / 1F',cols:6,f:1},{name:'split 6C / 1F',cols:6,f:1,split:true},{name:'single 7C / 1F',cols:7,f:1},{name:'single 12C / 1F',cols:12,f:1},{name:'single 6C / 2F',cols:6,f:2},{name:'split 6C / 2F',cols:6,f:2,split:true},{name:'single 6C / 3F',cols:6,f:3},{name:'split 6C / 3F',cols:6,f:3,split:true}];
const results=[];
console.error('Simulation ready',trials);
for(const config of cases)for(const policy of ['random','visible-depth-3']){
 console.error('Running',config.name,policy);
 const streaks=[];let ambiguous=0,receipts=0;
 for(let t=0;t<trials;t++){
  const seed=100003+t*7919;let dealt=0,randomState=seed;
  const rng=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const draw=()=>{const card=stockCard(seed,dealt++);const out=config.split?splitCard(card):card;if(config.split&&!validSplitPair(out.rank,out.alternateRank))throw Error('Invalid pair');return out;};
  let columns=Array.from({length:config.cols},()=>Array.from({length:3},draw));
  // Hero starts on 2; Dem on A; mature Riv samples a settled rank, not a perpetual wildcard.
  const ranks=[2,1,stockCard(seed,100000).rank].slice(0,config.f);
  let n=0;
  while(n<cap){const moves=options(columns,ranks);if(!moves.length)break;
   const m=choose(columns,ranks,moves,policy,rng);
   if(moves.filter(x=>x.c===m.c&&x.f===m.f).length>1)ambiguous++;
   ranks[m.f]=m.rank;columns[m.c]=[draw(),...columns[m.c].slice(0,-1)];n++;
  }streaks.push(n);receipts+=n;
 }
 streaks.sort((a,b)=>a-b);const pct=n=>100*n/trials;
 const result={...config,policy,trials,deadPct:pct(streaks.filter(n=>n===0).length),median:streaks[Math.floor(trials*.5)],p90:streaks[Math.floor(trials*.9)],mean:receipts/trials,sixPlusPct:pct(streaks.filter(n=>n>=6).length),cap100Pct:pct(streaks.filter(n=>n===cap).length),rankChoicePct:receipts?100*ambiguous/receipts:0};
 results.push(result);console.log(JSON.stringify(result));
}
mkdirSync('artifacts/split-card-sim',{recursive:true});
writeFileSync('artifacts/split-card-sim/results.json',JSON.stringify({trials,cap,results},null,2));
