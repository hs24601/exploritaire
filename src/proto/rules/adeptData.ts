import type {RarityTier} from './keruInvokeData';
export type AdeptEnhancement={tier:RarityTier};
export type AdeptFrenzy={actorId:string;targetId:string;stacks:number;seconds:number;foundation:number;stock:number[];columns:number[][];receipts:number;seed:number;history?:number[];clearedColumns?:number;lastAttack?:{targetId:string;damage:number;cleared:boolean}};
/** Draft rarity scales only the generous Frenzy clock, not AP bands or damage. */
export const ADEPT_TIERS=[{name:'Common',bonusSeconds:0},{name:'Rare',bonusSeconds:30},{name:'Epic',bonusSeconds:60},{name:'Legendary',bonusSeconds:90}] as const;
export function adeptExpression(ap:number){
 const n=Math.floor(ap);
 if(n===1)return{name:'Dig',damage:0,stacks:0};
 if(n>=2&&n<=4)return{name:'Bite',damage:n,stacks:0};
 if(n===5||n===6)return{name:'Vice Grip',damage:1,stacks:0};
 if(n>=7&&n<=9)return{name:'Frenzy '+['I','II','III'][n-7],damage:0,stacks:n-6};
 if(n>=10&&n<=12)return{name:'Avatar Howl',damage:[15,25,40][n-10],stacks:0};
 return null;
}
export const adeptText='Enhancement keru · Attach to a kin, not a foundation. Sets the maximum AP ceiling to exactly 12 without granting AP, a tableau-value foundation, and exactly +1 AP per receipt. Hero: 1 Dig; 2–4 Bite (1 base damage/AP); 5–6 Vice Grip; 7/8/9 Frenzy I/II/III; 10/11/12 Avatar Howl (15/25/40 base damage). Use an expression to spend all current AP. At 0 or above 12 AP no Hero expression is available. Other kin expressions are not authored yet. First-pass attachment is free and non-stacking.';



